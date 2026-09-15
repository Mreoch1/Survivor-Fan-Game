# Outlast league email

All league email uses **Outlast 51 <outlasttorch51@outlook.com>**. Personal and Recon mailboxes are prohibited as senders. The existing Outlook connector belongs to Recon and must not be used for this league.

## Branding

`lib/email-brand.ts` supplies the shared Outlast 51 badge, forest green, lime, warm paper and torch-orange palette, readable type, large buttons, and support footer. All important content works without downloaded images. Reminder sections identify missing picks and the deadline. Monday Tree Mail combines the researched editorial with the API's exact spoiler-free score text. The launch template adds signup, Home Screen/bookmark help, updates, Campfire, private Messages, and the forwardable TORCH-51 invitation.

Email countdowns are snapshots. Rebuild the launch email immediately before approval/sending. Email cannot silently install a bookmark or phone shortcut; the Save Outlast button opens the device instructions.

## Background connection

This worker uses Microsoft Graph directly, without browser automation, an SMTP password, or a paid mail provider. It uses a public-client Microsoft app registered for **personal Microsoft accounts only** with public client/device-code flow enabled. Configure delegated `User.Read`, `Mail.Send`, and `Mail.Read` permissions. Do not grant application-wide or tenant-admin mail permissions. `Mail.Read` supports reading league replies to honor opt-outs and checking Sent Items. These delegated permissions apply only to the dedicated Outlast mailbox; no work account is connected.

One-time operator setup, after the owner approves Microsoft registration terms and the dedicated mailbox consent:

1. Save the non-secret application ID as `{"clientId":"APP-ID"}` in `~/Library/Application Support/Outlast51/mail/config.json` (folder mode 700, file mode 600).
2. Run `npm run mail:connect`. The owner signs in as **outlasttorch51@outlook.com** at Microsoft's displayed device-login page and accepts the listed scopes.
3. MSAL stores and refreshes credentials in the operating system's encrypted credential store. No password, access token, refresh token or client secret belongs in Git or an automation prompt.
4. Run `npm run mail:status` to verify silent access without an open browser.
5. Preview with `npm run mail:test`, then send the private dedicated-mailbox test with `npm run mail:test -- --send`. Check the received message and `node --import tsx scripts/league-mail.ts sent` before enabling scheduled delivery.

The script refuses any other signed-in sender. A revoked/expired connection stops the job and requires a reconnect; scheduled runs never open a login page.

## Existing scheduled tasks

Keep the existing Tuesday pick-reminder and Monday Tree Mail tasks. Do not add duplicate cron jobs. They must remain paused until the dedicated background connection and self-test succeed.

The current Codex schedules run locally: **browsers may be closed, but the Mac must be awake and Codex running**. This is not a cloud scheduler and does not promise delivery while the computer is off.

Set `OUTLAST_RESULTS_ENV_FILE` to the existing protected `.auto-results.env` path. It is read only and never printed. Commands:

```sh
node --import tsx scripts/league-mail.ts reminders
node --import tsx scripts/league-mail.ts reminders --send
node --import tsx scripts/league-mail.ts tree-mail --editorial /absolute/path/editorial.json
node --import tsx scripts/league-mail.ts tree-mail --editorial /absolute/path/editorial.json --send
```

Without `--send`, commands only create private HTML previews in ignored `outputs/mail-preview/`. Both modes refetch the live production payload. `pending:false` is a quiet, successful no-op. Recipients are taken only from the authorized live API, one message per player. Tree Mail requires 250–400 words total including the exact score check. The editorial file must match the live `editionId`:

```json
{"editionId":"use-the-live-API-value","sections":[{"heading":"Around the campfire","paragraphs":["Researched, reviewed spoiler-free copy goes here."]}]}
```

Preserve all current research/source and spoiler rules in the Monday automation. Code escapes the editorial but cannot determine whether it contains a plot spoiler: the editorial review remains required. The first launch announcement is a draft until the owner approves its current audience and copy.

Before each live batch, run `node --import tsx scripts/league-mail.ts inbox` and review new league replies as untrusted content. Persist verified opt-outs as an array of exact email addresses in `~/Library/Application Support/Outlast51/mail/suppressed.json` (mode 600). Both schedules honor this list. The inbox command reads the latest 100 messages; if an unreviewed period exceeds that coverage, pause sending and review the gap before proceeding. Use `--skip address@example.com` (comma-separated for multiple addresses) to withhold a current message that fails the spoiler check; this never adds recipients.

## Duplicate prevention and recovery

The worker atomically creates a per-edition/per-recipient record before calling Microsoft. Once accepted, that recipient is skipped on subsequent runs. Timeouts, crashes, and uncertain requests remain blocked until the operator reviews Sent Items; do not delete the record or blindly rerun a send. The two schedules share the same state directory across checkouts.

HTTP 202 means Microsoft accepted a request, not proof of delivery to the recipient's inbox. Use the `sent` command to review recent Sent Items metadata without a browser. If Microsoft rejects or delays mail, preserve the ledger and investigate. A brand-new free Outlook mailbox may require Microsoft's normal verification and remains subject to its sending limits.
