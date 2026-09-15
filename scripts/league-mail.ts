import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { mailClient, mailbox, stateDirectory } from "./mail-client.mjs";
import { deliveryKey, deliverOnce } from "./mail-delivery.mjs";
import { emailFrame, emailSection, emailParagraph, emailButton, LEAGUE_SITE, renderTreeMail, type EditorialSection } from "../lib/email-brand";

type Email = { subject: string; html: string; plainText: string; previewText?: string };
type Player = { email: string; emailContent: Email };
type Payload = { pending: boolean; message?: string; editionId?: string; episode?: { id: number; lockAt: string }; players?: Player[] };
const [command, ...args] = process.argv.slice(2);
const sending = args.includes("--send");

async function livePayload(kind: "reminders" | "recap"): Promise<Payload> {
  const envPath = process.env.OUTLAST_RESULTS_ENV_FILE || fileURLToPath(new URL("../.auto-results.env", import.meta.url));
  const env = Object.fromEntries((await readFile(envPath, "utf8")).split(/\r?\n/).filter(line => line.includes("=")).map(line => {
    const split = line.indexOf("="); return [line.slice(0, split), line.slice(split + 1)];
  }));
  if (!env.AUTO_RESULTS_SECRET) throw new Error("The league API connection is missing");
  const response = await fetch(`${LEAGUE_SITE}/api/automation/${kind}`, {
    headers: { authorization: `Bearer ${env.AUTO_RESULTS_SECRET}` }, signal: AbortSignal.timeout(30_000), redirect: "error",
  });
  if (!response.ok) throw new Error(`League mail lookup failed (${response.status})`);
  return response.json();
}

async function main() {
  if (command === "connect") {
    const { mailbox: connected } = await mailClient({ interactive: true, deviceCodeCallback: (code: { message: string }) => console.log(code.message) });
    console.log(JSON.stringify({ connected, browserNeededForScheduledRuns: false }));
    return;
  }
  if (command === "status") {
    const client = await mailClient();
    console.log(JSON.stringify({ connected: client.mailbox, browserNeededForScheduledRuns: false }));
    return;
  }
  if (command === "sent") {
    const client = await mailClient();
    const result = await (await client.graph("/me/mailFolders/sentitems/messages?$select=subject,toRecipients,sentDateTime&$orderby=sentDateTime%20desc&$top=20")).json();
    console.log(JSON.stringify(result.value));
    return;
  }
  if (command === "inbox") {
    const client = await mailClient();
    const result = await (await client.graph("/me/mailFolders/inbox/messages?$select=id,from,subject,body,receivedDateTime&$orderby=receivedDateTime%20desc&$top=100", {
      headers: { Prefer: 'outlook.body-content-type="text"' },
    })).json();
    console.log(JSON.stringify(result));
    return;
  }
  if (!["test", "reminders", "tree-mail"].includes(command)) {
    throw new Error("Use connect, status, inbox, sent, test, reminders, or tree-mail --editorial FILE. Delivery requires --send.");
  }
  let players: Player[];
  let edition: string;
  let kind: "test" | "reminder" | "tree-mail";
  if (command === "test") {
    edition = "background-sender-verification-v1";
    kind = "test";
    players = [{ email: mailbox, emailContent: {
      subject: "TEST · Outlast 51 branded background email",
      plainText: "This test goes only to the dedicated Outlast mailbox. It verifies branded email sent without browser automation.",
      html: emailFrame({ title: "The torches are lit.", eyebrow: "PRIVATE SENDER TEST", previewText: "Testing the Outlast email look and background delivery.", sections:
        emailSection("1. A familiar look", emailParagraph("Outlast emails use our forest green, warm paper, and torch-orange colors, with the same 51 badge you see at camp.")) +
        emailSection("2. Easy to use", emailParagraph("Short sections and large buttons make it easy to find your picks, league updates, and help saving the site." ) + emailButton("Open Outlast", `${LEAGUE_SITE}/login?returnTo=%2Fplay`)) +
        emailSection("3. Sent in the background", emailParagraph("This private test uses the dedicated Outlast Microsoft connection. No league members are included.")),
      }),
    } }];
  } else {
    kind = command === "reminders" ? "reminder" : "tree-mail";
    const payload = await livePayload(command === "reminders" ? "reminders" : "recap");
    if (!payload.pending) { console.log(JSON.stringify(payload)); return; }
    players = payload.players || [];
    edition = kind === "reminder" ? String(payload.episode?.id || "") : payload.editionId || "";
    if (!edition || !players.length) throw new Error("No complete live mailing edition was returned");
    if (kind === "reminder" && (!payload.episode?.lockAt || Date.parse(payload.episode.lockAt) <= Date.now())) throw new Error("Picks are closed");
    if (kind === "tree-mail") {
      const index = args.indexOf("--editorial");
      if (index === -1 || !args[index + 1]) throw new Error("Tree Mail requires this week's reviewed editorial JSON");
      const editorial: { editionId: string; sections: EditorialSection[] } = JSON.parse(await readFile(args[index + 1], "utf8"));
      if (editorial.editionId !== edition || !Array.isArray(editorial.sections) || !editorial.sections.length) throw new Error("Editorial does not match the live Monday edition");
      if (editorial.sections.some(section => typeof section.heading !== "string" || !Array.isArray(section.paragraphs) || !section.paragraphs.length || section.paragraphs.some(text => typeof text !== "string"))) throw new Error("Invalid editorial sections");
      players = players.map(player => ({ ...player, emailContent: { ...player.emailContent,
        plainText: editorial.sections.map(section => `${section.heading}\n${section.paragraphs.join("\n\n")}`).join("\n\n") + "\n\n" + player.emailContent.plainText,
        html: renderTreeMail({ scoreText: player.emailContent.plainText, editorial: editorial.sections }),
      } }));
      if (players.some(player => {
        const words = player.emailContent.plainText.trim().split(/\s+/).length;
        return words < 250 || words > 400;
      })) throw new Error("Each Tree Mail editorial plus score check must contain 250–400 words");
    }
  }
  if (kind !== "test") {
    // Opt-outs persist across both jobs. A malformed suppression file must stop sending.
    let suppressed: string[] = [];
    try { suppressed = JSON.parse(await readFile(join(stateDirectory, "suppressed.json"), "utf8")); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    if (!Array.isArray(suppressed) || suppressed.some(value => typeof value !== "string")) throw new Error("Invalid league email suppression list");
    const skipIndex = args.indexOf("--skip");
    if (skipIndex !== -1 && !args[skipIndex + 1]) throw new Error("--skip requires comma-separated live recipient addresses");
    const skips = skipIndex === -1 ? [] : args[skipIndex + 1].split(",");
    const excluded = new Set([...suppressed, ...skips].map(address => address.toLowerCase()));
    players = players.filter(player => !excluded.has(player.email.toLowerCase()));
    if (!players.length) { console.log(JSON.stringify({ pending: false, message: "No unsuppressed recipients in this edition" })); return; }
  }
  const recipients = new Set<string>();
  for (const player of players) {
    deliveryKey(kind, edition, player.email);
    if (recipients.has(player.email.toLowerCase())) throw new Error("Duplicate recipient in live payload");
    recipients.add(player.email.toLowerCase());
  }
  if (!sending) {
    const output = fileURLToPath(new URL("../outputs/mail-preview/", import.meta.url));
    await mkdir(output, { recursive: true, mode: 0o700 });
    for (const [index, player] of players.entries()) await writeFile(join(output, `${kind}-${index + 1}.html`), player.emailContent.html, { mode: 0o600 });
    console.log(JSON.stringify({ mode: "preview-only", kind, edition, sender: mailbox, recipients: [...recipients], output }));
    return;
  }
  const client = await mailClient();
  const results = [];
  for (const player of players) results.push(await deliverOnce({ graph: client.graph,
    directory: join(stateDirectory, "deliveries"), key: deliveryKey(kind, edition, player.email), recipient: player.email, email: player.emailContent }));
  console.log(JSON.stringify({ kind, edition, sender: mailbox, results, note: "Accepted means Microsoft accepted the request, not proof of inbox delivery." }));
}

main().catch(error => { console.error(error instanceof Error ? error.message : "League mail failed"); process.exitCode = 1; });
