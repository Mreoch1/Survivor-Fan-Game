import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { PublicClientApplication } from "@azure/msal-node";
import { PersistenceCreator, PersistenceCachePlugin, DataProtectionScope } from "@azure/msal-node-extensions";

export const mailbox = "outlasttorch51@outlook.com";
export const stateDirectory = join(homedir(), "Library", "Application Support", "Outlast51", "mail");
const scopes = ["User.Read", "Mail.Send", "Mail.Read"];

/** @param {{interactive?: boolean, deviceCodeCallback?: (code: import('@azure/msal-node').DeviceCodeResponse) => void}} options */
export async function mailClient({ interactive = false, deviceCodeCallback } = {}) {
  await mkdir(stateDirectory, { recursive: true, mode: 0o700 });
  const config = JSON.parse(await readFile(join(stateDirectory, "config.json"), "utf8"));
  if (!/^[a-f0-9-]{36}$/i.test(config.clientId)) throw new Error("Outlast Microsoft app registration is missing");
  const persistence = await PersistenceCreator.createPersistence({
    cachePath: join(stateDirectory, "token-cache.lockfile"),
    dataProtectionScope: DataProtectionScope.CurrentUser,
    serviceName: "Outlast51.LeagueMail",
    accountName: mailbox,
    usePlaintextFileOnLinux: false,
  });
  const app = new PublicClientApplication({
    auth: { clientId: config.clientId, authority: "https://login.microsoftonline.com/consumers" },
    cache: { cachePlugin: new PersistenceCachePlugin(persistence) },
    system: { loggerOptions: { piiLoggingEnabled: false, loggerCallback: () => {} } },
  });
  const account = (await app.getTokenCache().getAllAccounts())
    .find(account => account.username.toLowerCase() === mailbox);
  let result;
  if (interactive) {
    if (!deviceCodeCallback) throw new Error("Interactive connection requires a device-code handoff");
    result = await app.acquireTokenByDeviceCode({ scopes, deviceCodeCallback });
  } else {
    if (!account) throw new Error("Outlast sender is not connected. Run the one-time mail:connect setup.");
    // Never open a browser from a scheduled run. Revoked access requires an owner reconnect.
    result = await app.acquireTokenSilent({ account, scopes });
  }
  if (result?.account?.username?.toLowerCase() !== mailbox) {
    if (result?.account) await app.getTokenCache().removeAccount(result.account);
    throw new Error("Wrong mailbox. Only the dedicated Outlast sender is allowed.");
  }
  async function graph(path, options = {}) {
    const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
      ...options,
      headers: { "content-type": "application/json", ...options.headers, authorization: `Bearer ${result.accessToken}` },
      signal: AbortSignal.timeout(30_000), redirect: "error",
    });
    if (!response.ok) throw new Error(`Microsoft mail request failed (${response.status}); check the connection before retrying.`);
    return response;
  }
  const profile = await (await graph("/me?$select=mail,userPrincipalName")).json();
  if ((profile.mail || profile.userPrincipalName || "").toLowerCase() !== mailbox) {
    throw new Error("Microsoft returned a different mailbox; sending is blocked.");
  }
  return { graph, mailbox };
}
