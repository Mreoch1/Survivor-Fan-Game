import { emailButton, emailFrame, emailParagraph, emailSection, LEAGUE_SITE } from "./email-brand";
import { formatEasternDeadline } from "./reminder-email";

/** Rebuild immediately before sending so the countdown is a dated, accurate snapshot. */
export function buildLaunchEmail({ now, airAt, lockAt }: { now: Date; airAt: string; lockAt: string }) {
  const timeLeft = Date.parse(airAt) - now.getTime();
  if (timeLeft <= 0 || Date.parse(lockAt) <= now.getTime()) throw new Error("Launch reminder is only for the open preseason");
  const calendar = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Detroit", year: "numeric", month: "2-digit", day: "2-digit" });
  const days = Math.round((Date.parse(calendar.format(new Date(airAt))) - Date.parse(calendar.format(now))) / 86_400_000);
  const title = days === 0 ? "Survivor starts tonight." : `${days} ${days === 1 ? "day" : "days"} until Survivor.`;
  const deadline = formatEasternDeadline(lockAt);
  const premiere = formatEasternDeadline(airAt);
  const signin = `${LEAGUE_SITE}/login?returnTo=%2Fplay`;
  const invite = `${LEAGUE_SITE}/signup?code=TORCH-51`;
  const sections = [
    { heading: "1. Sign in and save your picks", paragraphs: [
      `Survivor premieres ${premiere}. Our first picks close ${deadline}.`,
      "Already joined? Open Outlast, check that each required pick is filled in, and save your picks before the deadline.",
    ], button: ["Sign in & make picks", signin] },
    { heading: "2. Still need to join?", paragraphs: [
      "If you received our invite but have not signed up yet, there is still time. Create your free account, join TORCH-51, name your team, and make your picks.",
      "Have an account already? Use the sign-in button above.",
    ], button: ["Create my account", invite] },
    { heading: "3. Find Outlast with one tap", paragraphs: [
      "No more searching through old text messages. Add Outlast to your phone’s Home Screen, or bookmark it on your computer. The button below opens simple instructions for your device.",
      "Choose “Keep me signed in” when you sign in on your own device.",
    ], button: ["Help me save Outlast", `${LEAGUE_SITE}/save`] },
    { heading: "4. See what’s new at camp", paragraphs: [
      "Outlast shows important updates when you sign in. Read the short notice and tap “Got it.” You can find it again on the Updates page.",
      "Use Messages for private conversations. Visit Campfire to share ideas, join the conversation, and vote for improvements you would like to see.",
    ], button: ["See league updates", `${LEAGUE_SITE}/updates`] },
    { heading: "5. Bring friends and family", paragraphs: [
      "Forward this email to anyone you would like to invite. They can use the button below to sign up and join our group with code TORCH-51.",
      "This is our first year running Survivor fantasy together. We will keep improving the experience as we learn what everyone enjoys. Share your ideas at Campfire, or reply to this email. Thanks for helping make it fun!",
    ], button: ["Join our family league", invite] },
  ];
  const subject = `Our first Outlast season starts soon · ${days} ${days === 1 ? "day" : "days"} to go`;
  const plainText = [title, `Countdown prepared ${formatEasternDeadline(now)}.`, ...sections.flatMap(section => ["", section.heading, ...section.paragraphs, `${section.button[0]}: ${section.button[1]}`])].join("\n");
  const html = emailFrame({ title, eyebrow: "WELCOME TO TORCH-51 · OUR FIRST SEASON", previewText: `Picks close ${deadline}. Join, save your picks, and bring a friend.`, sections:
    sections.map(section => emailSection(section.heading, section.paragraphs.map(emailParagraph).join("") + emailButton(section.button[0], section.button[1]))).join("") });
  return { subject, plainText, html };
}
