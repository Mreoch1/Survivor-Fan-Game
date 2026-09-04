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
  const wildCard = pick?.bonus_pick || "No pick yet";
  const shotTarget =
    pick?.double_down === "immunity"
      ? `Immunity Pick · ${immunity}`
      : pick?.double_down === "boot"
        ? `Vote-Out Pick · ${voteOut}`
        : pick?.double_down === "bonus"
          ? `Wild Card Pick · ${wildCard}`
          : "Saved for a later episode";
  const receipts: PickReceipt[] = [
    { label: missingLabels.favorite, selection: favorite, required: true },
    { label: missingLabels.immunity, selection: immunity, required: true },
    { label: "Vote-Out Pick", selection: voteOut, required: false },
    { label: "Wild Card Pick", selection: wildCard, required: false },
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

function escapeHtml(value: string | number) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
    "Eligible saved picks carry forward when possible. Contact Mike if you no longer want pick reminders.",
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
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#081912;font-family:Arial,Helvetica,sans-serif;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;">You still need ${escapeHtml(missingSentence)}. Picks lock ${escapeHtml(deadline)}.</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#081912;"><tr><td align="center" style="padding:28px 12px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#f6f0df;border:1px solid #49604e;border-radius:18px;overflow:hidden;"><tr><td style="padding:30px 34px 26px;background:#102a1c;border-bottom:5px solid #e16b2c;"><p style="margin:0 0 10px;color:#e8b44f;font-size:12px;line-height:16px;font-weight:700;letter-spacing:2px;">OUTLAST 51 · EPISODE ${episodeId}</p><h1 style="margin:0;color:#fff8e7;font-family:Georgia,serif;font-size:34px;line-height:39px;font-weight:700;">Your voting booth closes tomorrow.</h1><p style="margin:14px 0 0;color:#d9e3da;font-size:15px;line-height:22px;">${escapeHtml(episodeTitle)} · Picks lock ${escapeHtml(deadline)}</p></td></tr><tr><td style="padding:28px 34px 10px;"><p style="margin:0 0 14px;color:#1d2b23;font-size:16px;line-height:24px;">Hi ${escapeHtml(firstName(playerName))}, the torches are lit, but ${escapeHtml(campName)} still has required picks missing:</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#234431;border-radius:12px;"><tr><td style="padding:17px 20px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${missingRows}</table></td></tr></table><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 0 22px;"><a href="${escapeHtml(leagueUrl)}" style="display:inline-block;background:#e16b2c;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:14px 24px;border-radius:999px;">Enter the voting booth</a></td></tr></table><p style="margin:0 0 8px;color:#8b4e23;font-size:12px;line-height:16px;font-weight:700;letter-spacing:1.5px;">YOUR PARCHMENT</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${receiptRows}</table></td></tr><tr><td style="padding:24px 34px 26px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#102a1c;border-radius:12px;"><tr><td style="padding:18px 20px;"><p style="margin:0 0 9px;color:#e8b44f;font-size:12px;line-height:16px;font-weight:700;letter-spacing:1.5px;">CAMP STATUS</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${standingRows}</table></td></tr></table></td></tr><tr><td style="padding:20px 34px 28px;background:#e9dfc8;color:#655e50;font-size:12px;line-height:18px;"><strong style="color:#274131;">Spoiler-free by design.</strong> This reminder contains league standings only—no episode recap or castaway results.<br><br>Eligible saved picks carry forward when possible. Contact Mike if you no longer want pick reminders.</td></tr></table></td></tr></table></body></html>`;
  return { subject, previewText: `You still need ${missingSentence}. Picks lock ${deadline}.`, plainText, html };
}
