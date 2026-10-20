import { randomUUID } from "node:crypto";
import { open, unlink } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

/** @typedef {import('@azure/msal-node-extensions').IPersistenceConfiguration & {cachePath: string}} PersistenceConfiguration */
/** @typedef {import('@azure/msal-node-extensions').IPersistence} Persistence */

/**
 * Serialize startup across our mail scripts. Never steal a lock from an unknown
 * owner: an interrupted process requires checking the owner before removing it.
 * MSAL continues to own its separate token-cache read/write lock.
 * @template T
 * @param {string} path
 * @param {() => Promise<T>} initialize
 * @param {number} timeoutMs
 */
async function withInitializationLock(path, initialize, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let handle;
  while (!handle) {
    try {
      handle = await open(path, "wx", 0o600);
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      if (Date.now() >= deadline) {
        throw new Error("Outlast mail initialization is already locked. Check for another mail process before retrying; never remove an active lock.");
      }
      await delay(Math.min(100, Math.max(1, deadline - Date.now())));
    }
  }
  try {
    await handle.writeFile(String(process.pid));
    return await initialize();
  } finally {
    // Unlink while holding the handle, as in MSAL's own cache lock.
    try { await unlink(path); } finally { await handle.close(); }
  }
}

/**
 * MSAL 5.5.0 validates every macOS cache using the same global Keychain entry,
 * before its cache lock is held. Use its public KeychainPersistence API for an
 * equivalent encrypted write/read/compare/delete with an isolated probe.
 * Factory injection keeps tests entirely outside the real Keychain.
 * @param {PersistenceConfiguration} config
 * @param {{
 *   platform?: NodeJS.Platform,
 *   keychainCreate?: (path: string, service: string, account: string) => Promise<Persistence>,
 *   createPersistence?: (config: PersistenceConfiguration) => Promise<Persistence>,
 *   lockTimeoutMs?: number,
 * }} dependencies
 * @returns {Promise<Persistence>}
 */
export async function createMailPersistence(config, {
  platform = process.platform,
  keychainCreate = async (...args) => {
    const { KeychainPersistence } = await import("@azure/msal-node-extensions");
    return KeychainPersistence.create(...args);
  },
  createPersistence = async configuration => {
    const { PersistenceCreator } = await import("@azure/msal-node-extensions");
    return PersistenceCreator.createPersistence(configuration);
  },
  lockTimeoutMs = 50_000,
} = {}) {
  return withInitializationLock(`${config.cachePath}.initialize.lock`, async () => {
    if (platform !== "darwin") return createPersistence(config);
    if (!config.serviceName || !config.accountName) throw new Error("Outlast encrypted mail cache identity is missing.");

    const probeId = randomUUID();
    const probePath = `${config.cachePath}.validation-${probeId}`;
    let probe;
    let failure;
    let stage = "create";
    try {
      probe = await keychainCreate(probePath, `${config.serviceName}.PersistenceValidation`, probeId);
      const marker = `Outlast persistence validation ${randomUUID()}`;
      stage = "write";
      await probe.save(marker);
      stage = "read";
      const loaded = await probe.load();
      stage = "compare";
      if (loaded !== marker) throw new Error("Probe mismatch");
    } catch {
      // Never include cache contents, an MSAL error payload, or tokens in logs.
      failure = `Outlast encrypted mail cache validation failed during ${stage}.`;
    } finally {
      if (probe) {
        let deleted = false;
        try {
          deleted = await probe.delete();
        } catch {
          // Report only the failed stage, never the underlying cache payload.
        }
        if (!deleted) {
          failure = `${failure ? `${failure} ` : ""}Outlast encrypted mail cache validation cleanup failed.`;
        }
      }
    }
    if (failure) throw new Error(failure);
    // Preserve the real Keychain service/account and MSAL marker file exactly.
    return keychainCreate(config.cachePath, config.serviceName, config.accountName);
  }, lockTimeoutMs);
}
