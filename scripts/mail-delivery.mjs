import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { mkdir, open } from "node:fs/promises";
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
  const receiptPath = join(directory, `${key}.accepted.json`);
  let record;
  try {
    record = await open(path, "wx", 0o600);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const existing = await open(receiptPath, constants.O_RDONLY | constants.O_NOFOLLOW).catch(() => {
      throw new Error(`Delivery ${key} needs review in Sent Items. It will not be sent again automatically.`);
    });
    try {
      const previous = JSON.parse(await existing.readFile("utf8"));
      if (previous.key !== key) throw new Error("Delivery record identity does not match");
      if (previous.status === "accepted") return { status: "already-accepted", key };
      throw new Error(`Delivery ${key} needs review in Sent Items. It will not be sent again automatically.`);
    } finally { await existing.close(); }
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
    // Keep the intent immutable. A separate receipt is created only after acceptance.
    const receipt = await open(receiptPath, "wx", 0o600);
    try {
      await receipt.writeFile(JSON.stringify({ key, recipient, subject: email.subject, startedAt, status: "accepted" }));
      await receipt.sync();
    } finally { await receipt.close(); }
    return { status: "accepted", key };
  } finally {
    await record.close();
  }
}
