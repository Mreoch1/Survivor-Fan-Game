import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import { promisify } from "node:util";
import type { IPersistence } from "@azure/msal-node-extensions";
import { createMailPersistence } from "../scripts/mail-persistence.mjs";

const run = promisify(execFile);

function fakePersistence(overrides: Partial<IPersistence> = {}): IPersistence {
  let data: string | null = null;
  return {
    save: async value => { data = value; },
    load: async () => data,
    delete: async () => { data = null; return true; },
    reloadNecessary: async () => false,
    getFilePath: () => "unused-test-path",
    getLogger: () => { throw new Error("Tests must not use MSAL logging"); },
    verifyPersistence: async () => { throw new Error("Global validation must not run"); },
    createForPersistenceValidation: async () => { throw new Error("Global probe must not run"); },
    ...overrides,
  };
}

async function fixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "outlast-mail-persistence-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return { directory, config: {
    cachePath: join(directory, "token-cache.lockfile"),
    serviceName: "Outlast51.LeagueMail.Fixture",
    accountName: "fixture@example.test",
    usePlaintextFileOnLinux: false,
  } };
}

test("macOS validates an isolated encrypted probe before returning the unchanged real cache", async t => {
  const { directory, config } = await fixture(t);
  const operations: string[] = [];
  const identities: string[][] = [];
  const real = fakePersistence();
  let marker = "";
  const keychainCreate = async (path: string, service: string, account: string) => {
    identities.push([path, service, account]);
    if (path === config.cachePath) { operations.push("real"); return real; }
    operations.push("probe");
    assert.equal((await stat(`${config.cachePath}.initialize.lock`)).mode & 0o777, 0o600);
    return fakePersistence({
      save: async value => { operations.push("write"); marker = value; },
      load: async () => { operations.push("read"); return marker; },
      delete: async () => { operations.push("delete"); return true; },
    });
  };
  assert.equal(await createMailPersistence(config, { platform: "darwin", keychainCreate }), real);
  assert.deepEqual(operations, ["probe", "write", "read", "delete", "real"]);
  assert.equal(identities[0][1], `${config.serviceName}.PersistenceValidation`);
  assert.notEqual(identities[0][2], config.accountName);
  assert.match(identities[0][0], /\.validation-[a-f0-9-]+$/);
  assert.deepEqual(identities[1], [config.cachePath, config.serviceName, config.accountName]);
  assert.deepEqual(await readdir(directory), []);
  await createMailPersistence(config, { platform: "darwin", keychainCreate });
  assert.notEqual(identities[0][0], identities[2][0]);
  assert.notEqual(identities[0][2], identities[2][2]);
});

test("macOS validation fails closed on create, write, read, mismatch and cleanup failures", async t => {
  const { directory, config } = await fixture(t);
  for (const failure of ["create", "write", "read", "null", "mismatch", "delete", "delete-false"]) {
    let deletes = 0;
    let realCreated = false;
    let marker = "";
    const sensitiveError = new Error("fixture-secret-that-must-not-be-logged");
    const keychainCreate = async (path: string) => {
      if (path === config.cachePath) { realCreated = true; return fakePersistence(); }
      if (failure === "create") throw sensitiveError;
      return fakePersistence({
        save: async value => { if (failure === "write") throw sensitiveError; marker = value; },
        load: async () => {
          if (failure === "read") throw sensitiveError;
          return failure === "null" ? null : failure === "mismatch" ? sensitiveError.message : marker;
        },
        delete: async () => { deletes++; if (failure === "delete") throw sensitiveError; return failure !== "delete-false"; },
      });
    };
    await assert.rejects(createMailPersistence(config, { platform: "darwin", keychainCreate }), error => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /Outlast encrypted mail cache validation/);
      assert.ok(!error.message.includes(sensitiveError.message));
      return true;
    });
    assert.equal(realCreated, false, failure);
    assert.equal(deletes, failure === "create" ? 0 : 1, failure);
    assert.deepEqual(await readdir(directory), [], "Initialization lock is released after failure");
  }
  await createMailPersistence(config, { platform: "darwin", keychainCreate: async () => fakePersistence() });
});

test("other platforms preserve MSAL persistence configuration and reject its failures", async t => {
  const { directory, config } = await fixture(t);
  const real = fakePersistence();
  for (const platform of ["linux", "win32"] as const) {
    const result = await createMailPersistence(config, {
      platform,
      createPersistence: async received => { assert.equal(received, config); return real; },
      keychainCreate: async () => { throw new Error("No macOS factory on another platform"); },
    });
    assert.equal(result, real);
  }
  await assert.rejects(createMailPersistence(config, {
    platform: "linux", createPersistence: async () => { throw new Error("Secure persistence unavailable"); },
  }), /Secure persistence unavailable/);
  assert.deepEqual(await readdir(directory), []);
  assert.equal(config.usePlaintextFileOnLinux, false);
});

test("an existing initialization lock is neither stolen nor followed by a cache operation", async t => {
  const { config } = await fixture(t);
  const lock = `${config.cachePath}.initialize.lock`;
  await writeFile(lock, "other-process", { mode: 0o600 });
  let called = false;
  await assert.rejects(createMailPersistence(config, {
    platform: "darwin", lockTimeoutMs: 10,
    keychainCreate: async () => { called = true; return fakePersistence(); },
  }), /already locked/);
  assert.equal(called, false);
  assert.equal(await readFile(lock, "utf8"), "other-process");
});

test("separate processes serialize their complete validation and real-cache creation", async t => {
  const { directory, config } = await fixture(t);
  const events = join(directory, "events");
  const moduleUrl = new URL("../scripts/mail-persistence.mjs", import.meta.url).href;
  const child = (id: string) => `
    import { appendFile } from "node:fs/promises";
    import { setTimeout as delay } from "node:timers/promises";
    import { createMailPersistence } from ${JSON.stringify(moduleUrl)};
    const config = ${JSON.stringify(config)};
    const record = event => appendFile(${JSON.stringify(events)}, ${JSON.stringify(id)} + ":" + event + "\\n");
    let value;
    await createMailPersistence(config, {
      platform: "darwin", lockTimeoutMs: 5000,
      keychainCreate: async path => {
        if (path === config.cachePath) { await record("real"); return {}; }
        await record("probe");
        return {
          save: async marker => { value = marker; await delay(80); },
          load: async () => value,
          delete: async () => { await record("delete"); return true; },
        };
      },
    });
  `;
  await Promise.all(["a", "b"].map(id => run(process.execPath, ["--input-type=module", "-e", child(id)])));
  const lines = (await readFile(events, "utf8")).trim().split("\n");
  const first = lines[0].split(":")[0];
  const second = first === "a" ? "b" : "a";
  assert.deepEqual(lines, [`${first}:probe`, `${first}:delete`, `${first}:real`, `${second}:probe`, `${second}:delete`, `${second}:real`]);
  assert.deepEqual(await readdir(directory), ["events"]);
});
