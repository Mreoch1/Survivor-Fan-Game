import { emailButton, emailFrame, emailParagraph, emailSection, escapeHtml, LEAGUE_SITE } from "./email-brand";

export type ReminderPick = {
  favorite_id: string;
  immunity_pick: string;
  boot_pick: string;
  bonus_pick: string;
  double_down: string;
};

export type ReminderProfile = {
  individual_game_pick: string | null;
  endgame_pick: string | null;
};

export type PickReceipt = { label: string; selection: string; required: boolean };

export type LeagueSnapshot = {
  playerRank: number;
  playerPoints: number;
  leaderName: string | null;
  leaderPoints: number | null;
  latestEpisodeId: number | null;
  latestHighScorerNames: string[];
  latestHighScore: number | null;
};

const missingLabels = {
  favorite: "Weekly Favorite Pick",
  immunity: "Immunity Pick",
  boot: "Vote-Out Pick",
  opening: "Opening Outlast Pick",
  finalTorch: "Final Torch Pick",
} as const;

export function getMissingRequiredPicks({
  episodeId,
  pick,
  profile,
  finalTorchDecisionOpen,
}: {
  episodeId: number;
  pick: ReminderPick | null;
  profile: ReminderProfile;
  finalTorchDecisionOpen: boolean;
}) {
  const missing: string[] = [];
  if (!pick?.favorite_id) missing.push(missingLabels.favorite);
  if (!pick?.immunity_pick) missing.push(missingLabels.immunity);
  if (!pick?.boot_pick) missing.push(missingLabels.boot);
  if (episodeId === 1 && !profile.individual_game_pick) missing.push(missingLabels.opening);
  if (finalTorchDecisionOpen && !profile.endgame_pick) missing.push(missingLabels.finalTorch);
  return missing;
}

export function getPickReceipts({
  episodeId,
  phase,
  pick,
  profile,
  finalTorchDecisionOpen,
  castawayName,
}: {
  episodeId: number;
  phase: "tribe" | "individual";
  pick: ReminderPick | null;
  profile: ReminderProfile;
  finalTorchDecisionOpen: boolean;
  castawayName: (id: string | null | undefined) => string | null;
}): PickReceipt[] {
  const favorite = castawayName(pick?.favorite_id) || "No pick yet";
  const immunity = pick?.immunity_pick
    ? phase === "tribe"
      ? `${pick.immunity_pick} Tribe`
      : castawayName(pick.immunity_pick) || pick.immunity_pick
    : "No pick yet";
  const voteOut = castawayName(pick?.boot_pick) || "No pick yet";
  const wildCard = pick?.bonus_pick || "Skipped · 0 points";
  const shotTarget =
    pick?.double_down === "immunity"
      ? `Immunity Pick · ${immunity}`
      : pick?.double_down === "boot"
        ? `Vote-Out Pick · ${voteOut}`
        : pick?.double_down === "bonus"
          ? `Play Your Advantage · ${wildCard}`
          : "Saved for a later episode";
  const receipts: PickReceipt[] = [
    { label: missingLabels.favorite, selection: favorite, required: true },
    { label: missingLabels.immunity, selection: immunity, required: true },
    { label: missingLabels.boot, selection: voteOut, required: true },
    { label: "Play Your Advantage", selection: wildCard, required: false },
    { label: "Shot in the Dark", selection: shotTarget, required: false },
  ];
  if (episodeId === 1) {
    receipts.splice(2, 0, {
      label: missingLabels.opening,
      selection: castawayName(profile.individual_game_pick) || "No pick yet",
      required: true,
    });
  }
  if (finalTorchDecisionOpen) {
    receipts.splice(2, 0, {
      label: missingLabels.finalTorch,
      selection: castawayName(profile.endgame_pick) || "No pick yet",
      required: true,
    });
  }
  return receipts;
}

export function formatEasternDeadline(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  const datePart = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Detroit",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
  const timePart = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Detroit",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `${datePart} at ${timePart} ET`;
}

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || "castaway";
}

function pointLabel(points: number) {
  return `${points} ${points === 1 ? "point" : "points"}`;
}

export function buildReminderEmail({
  playerName,
  teamName,
  episodeId,
  episodeTitle,
  lockAt,
  leagueUrl,
  missingPicks,
  receipts,
  snapshot,
}: {
  playerName: string;
  teamName: string;
  episodeId: number;
  episodeTitle: string;
  lockAt: string;
  leagueUrl: string;
  missingPicks: string[];
  receipts: PickReceipt[];
  snapshot: LeagueSnapshot;
}) {
  const deadline = formatEasternDeadline(lockAt);
  const subject = `Your voting booth closes tomorrow · Outlast 51 Episode ${episodeId}`;
  const missingSentence = missingPicks.join(missingPicks.length > 1 ? ", " : "");
  const campName = teamName || playerName;
  const standingLines = [`Your camp: #${snapshot.playerRank} · ${pointLabel(snapshot.playerPoints)}`];
  if (snapshot.leaderName && snapshot.leaderPoints !== null) {
    standingLines.push(`Torch Leader: ${snapshot.leaderName} · ${pointLabel(snapshot.leaderPoints)}`);
  }
  if (snapshot.latestEpisodeId && snapshot.latestHighScorerNames.length && snapshot.latestHighScore !== null) {
    standingLines.push(
      `Last episode's high score: ${snapshot.latestHighScorerNames.join(" & ")} · ${pointLabel(snapshot.latestHighScore)}`,
    );
  } else {
    standingLines.push("Camp status: the first leaderboard update arrives after Episode 1.");
  }
  const receiptLines = receipts.map((receipt) => `${receipt.label}: ${receipt.selection}`);
  const plainText = [
    `OUTLAST 51 · EPISODE ${episodeId}`,
    "",
    `Hi ${firstName(playerName)},`,
    "",
    `Your voting booth closes tomorrow. You still need: ${missingSentence}.`,
    `Picks lock ${deadline}.`,
    "",
    `Make your picks: ${leagueUrl}`,
    "",
    "YOUR PARCHMENT",
    ...receiptLines,
    "",
    "CAMP STATUS",
    ...standingLines,
    "",
    "This is a spoiler-free league update—no episode recap or castaway results.",
    "Eligible Favorite, Immunity, and Vote-Out Picks carry forward. Play Your Advantage requires a fresh choice each week: +1 correct, -1 wrong, or 0 if skipped. Contact Mike if you no longer want pick reminders.",
  ].join("\n");
  const receiptRows = receipts
    .map(
      (receipt) =>
        `<tr><td style="padding:9px 0;border-bottom:1px solid #d8cfb8;color:#5b5549;font-size:13px;line-height:18px;">${escapeHtml(receipt.label)}${receipt.required ? ' <span style="color:#b84b22;">· REQUIRED</span>' : ' <span style="color:#777064;">· OPTIONAL</span>'}</td><td align="right" style="padding:9px 0 9px 16px;border-bottom:1px solid #d8cfb8;color:#16291f;font-size:14px;line-height:18px;font-weight:700;">${escapeHtml(receipt.selection)}</td></tr>`,
    )
    .join("");
  const missingRows = missingPicks
    .map(
      (label) =>
        `<tr><td style="padding:5px 0;color:#fff7e9;font-size:16px;line-height:22px;"><span style="color:#f4a340;">●</span>&nbsp;&nbsp;${escapeHtml(label)}</td></tr>`,
    )
    .join("");
  const standingRows = standingLines
    .map((line) => `<tr><td style="padding:4px 0;color:#e8e0ca;font-size:14px;line-height:20px;">${escapeHtml(line)}</td></tr>`)
    .join("");
  const html = emailFrame({
    title: "Your picks close tomorrow.",
    eyebrow: `EPISODE ${episodeId} · PICK REMINDER`,
    previewText: `You still need ${missingSentence}. Picks lock ${deadline}.`,
    sections: emailSection("1. Finish your picks", emailParagraph(`Hi ${firstName(playerName)}, ${campName} still needs these picks:`) +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#234431"><tr><td style="padding:16px 20px;"><table role="presentation" width="100%">${missingRows}</table></td></tr></table>` +
      `<p style="margin:18px 0 0;font-size:16px;line-height:25px;color:#10291f;"><strong>Picks close ${escapeHtml(deadline)}.</strong><br>${escapeHtml(episodeTitle)}</p>` +
      emailButton("Sign in & make picks", `${new URL(leagueUrl).origin}/login?returnTo=%2Fplay`)) +
      emailSection("2. Your picks on file", `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${receiptRows}</table>`) +
      emailSection("3. Around camp", `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#10291f"><tr><td style="padding:16px 20px;"><table role="presentation" width="100%">${standingRows}</table></td></tr></table>` +
        `<p style="margin:16px 0 0;font-size:14px;line-height:22px;color:#43584c;">Eligible Favorite, Immunity, and Vote-Out Picks carry forward. Play Your Advantage needs a fresh choice each week: +1 correct, -1 wrong, or 0 if skipped.</p>` +
        `<p style="margin:12px 0 0;font-size:14px;line-height:22px;color:#43584c;">This reminder contains league standings only, with no episode recap or castaway results. <a href="${LEAGUE_SITE}/updates" style="color:#10291f;">See what’s new in Outlast</a>.</p>`),
  });
  return { subject, previewText: `You still need ${missingSentence}. Picks lock ${deadline}.`, plainText, html };
}
