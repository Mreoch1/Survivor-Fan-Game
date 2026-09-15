export const LEAGUE_MAILBOX = "outlasttorch51@outlook.com";
export const LEAGUE_SITE = "https://survivor-fan-game.vercel.app";

export function escapeHtml(value: string | number) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export function emailButton(label: string, url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("Email links must use HTTPS");
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0;"><tr><td bgcolor="#10291f" style="border-radius:5px;mso-padding-alt:15px 24px;"><a href="${escapeHtml(url)}" style="display:inline-block;padding:15px 24px;color:#ffffff;font:700 16px Arial,Helvetica,sans-serif;text-decoration:none;border:1px solid #10291f;border-radius:5px;">${escapeHtml(label)}</a></td></tr></table>`;
}

export function emailParagraph(value: string) {
  return `<p style="margin:0 0 16px;color:#10291f;font-size:16px;line-height:25px;overflow-wrap:anywhere;">${escapeHtml(value)}</p>`;
}

export function emailSection(heading: string, body: string) {
  return `<tr><td class="mail-pad" style="padding:26px 30px;border-bottom:1px solid #d8dfce;"><h2 style="margin:0 0 15px;color:#10291f;font:700 23px/29px Georgia,'Times New Roman',serif;">${escapeHtml(heading)}</h2>${body}</td></tr>`;
}

/** Tables, inline colors and system fonts keep the layout useful with images blocked. */
export function emailFrame({ title, eyebrow, previewText, sections }: {
  title: string; eyebrow: string; previewText: string; sections: string;
}) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · Outlast 51</title><style>@media(max-width:480px){.mail-pad{padding:24px 20px!important}.mail-title{font-size:32px!important;line-height:36px!important}}</style></head><body style="margin:0;padding:0;background:#e8ebdf;font-family:Arial,Helvetica,sans-serif;"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(previewText)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#e8ebdf"><tr><td align="center" style="padding:24px 12px;"><!--[if mso]><table role="presentation" width="620"><tr><td><![endif]--><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#fffdf7;border:1px solid #cbd3c3;"><tr><td class="mail-pad" bgcolor="#10291f" style="padding:30px;border-bottom:5px solid #f07838;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="48" height="48" align="center" bgcolor="#c9f055" style="color:#10291f;font:700 27px Georgia,serif;border-radius:50%;">51</td><td style="padding-left:12px;color:#fffdf7;font-size:19px;line-height:22px;font-weight:800;letter-spacing:2px;">OUTLAST<br><span style="font-size:10px;letter-spacing:2px;color:#c9f055;">FAMILY FANTASY LEAGUE</span></td></tr></table><p style="margin:28px 0 10px;color:#e8b44f;font-size:12px;line-height:18px;letter-spacing:1.5px;font-weight:700;">${escapeHtml(eyebrow)}</p><h1 class="mail-title" style="margin:0;color:#fffdf7;font:700 38px/43px Georgia,'Times New Roman',serif;">${escapeHtml(title)}</h1></td></tr>${sections}<tr><td class="mail-pad" style="padding:24px 30px;background:#f5f0e5;font-size:13px;line-height:21px;color:#43584c;"><strong style="color:#10291f;">Your league, one tap away.</strong><br><a href="${LEAGUE_SITE}/save" style="color:#10291f;text-decoration:underline;">Save Outlast to your phone or bookmark it</a><br><br>Questions or feedback? Reply to this email. To stop league emails, reply “unsubscribe.”<br><br>Outlast 51 · Our independent family fantasy league.<br>Not affiliated with CBS, Paramount, or Survivor.</td></tr></table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
}

export type EditorialSection = { heading: string; paragraphs: string[] };

export function renderTreeMail({ scoreText, editorial = [] }: { scoreText: string; editorial?: EditorialSection[] }) {
  const blocks = scoreText.split(/\n\n/).filter(Boolean);
  const greeting = blocks.shift() || "Welcome back to camp.";
  const body = emailSection("From our camp", emailParagraph(greeting)) +
    editorial.map(section => emailSection(section.heading, section.paragraphs.map(emailParagraph).join(""))).join("") +
    emailSection("Your fantasy league check-in", blocks
      .filter(block => !block.startsWith("Unofficial Outlast"))
      .map(block => emailParagraph(block).replaceAll("\n", "<br>")).join("") +
      emailButton("Open Outlast", `${LEAGUE_SITE}/login?returnTo=%2Fplay`));
  return emailFrame({ title: "Tree Mail", eyebrow: "MONDAY AT CAMP · SPOILER-FREE", previewText: "Your weekly camp dispatch and fantasy league check-in. No episode outcomes inside.", sections: body });
}
