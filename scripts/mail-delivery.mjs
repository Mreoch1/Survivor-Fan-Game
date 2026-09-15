import { createHash } from "node:crypto";
import { mkdir, open, readFile } from "node:fs/promises";
import { join } from "node:path";

export function deliveryKey(kind, edition, recipient) {
  if (!["reminder", "tree-mail", "test"].includes(kind) || !edition) throw new Error("Invalid email edition");
  if (!/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(recipient)) throw new Error("Invalid single recipient");
  return createHash("sha256").update(`${kind}:${edition}:${recipient.toLowerCase()}`).digest("hex");
}

export async function deliverOnce({ graph, directory, key, recipient, email }) {
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error("Invalid delivery key");
  if (!email.subject || !email.html || !email.plainText || /[\r\n]/.test(email.subject)) throw new Error("Email content is incomplete");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, `${key}.json`);
  let record;
  try {
    record = await open(path, "wx", 0o600);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const previous = JSON.parse(await readFile(path, "utf8"));
    if (previous.status === "accepted") return { status: "already-accepted", key };
    throw new Error(`Delivery ${key} needs review in Sent Items. It will not be sent again automatically.`);
  }
  const startedAt = new Date().toISOString();
  try {
    // Persist the intent before the network call. A crash or timeout must not cause duplicate mail.
    await record.writeFile(JSON.stringify({ key, recipient, subject: email.subject, startedAt, status: "uncertain" }));
    await record.sync();
    const response = await graph("/me/sendMail", { method: "POST", body: JSON.stringify({
      message: { subject: email.subject, body: { contentType: "HTML", content: email.html },
        toRecipients: [{ emailAddress: { address: recipient } }],
        internetMessageHeaders: [{ name: "x-outlast-delivery", value: key }] },
      saveToSentItems: true,
    }) });
    if (response.status !== 202) throw new Error("Microsoft did not accept the message; review before retrying.");
    await record.truncate(0);
    await record.write(JSON.stringify({ key, recipient, subject: email.subject, startedAt, status: "accepted" }), 0, "utf8");
    await record.sync();
    return { status: "accepted", key };
  } finally {
    await record.close();
  }
}
