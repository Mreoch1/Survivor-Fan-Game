export type RecapPick = {
  favorite_id: string;
  immunity_pick: string;
  boot_pick: string;
  bonus_pick: string;
  double_down: string;
  carried_from_episode_id: number | null;
  favorite_point: number;
  immunity_point: number;
  boot_point: number;
  bonus_point: number;
  underdog_point: number;
  streak_point: number;
  double_point: number;
};

export type PointRow = { label: string; selection: string; points: number };
export type RankedScore = { rank: number; name: string; points: number };
export type ResultItem = { label: string; value: string };

export function buildPointBreakdown({
  pick,
  phase,
  castawayName,
  individualGameStarted,
  individualGamePick,
  individualGamePoints,
  finale,
  endgamePick,
  endgamePoints,
}: {
  pick: RecapPick | null;
  phase: "tribe" | "individual";
  castawayName: (id: string | null | undefined) => string | null;
  individualGameStarted: boolean;
  individualGamePick: string | null;
  individualGamePoints: number;
  finale: boolean;
  endgamePick: string | null;
  endgamePoints: number;
}) {
  const favorite = castawayName(pick?.favorite_id) || "No pick on file";
  const immunity = pick?.immunity_pick
    ? phase === "tribe"
      ? `${pick.immunity_pick} Tribe`
      : castawayName(pick.immunity_pick) || pick.immunity_pick
    : "No pick on file";
  const voteOut = castawayName(pick?.boot_pick) || "No pick on file";
  const wildCard = pick?.bonus_pick || "Skipped · 0 points";
  const shotSelection =
    pick?.double_down === "immunity"
      ? `Immunity Pick · ${immunity}`
      : pick?.double_down === "boot"
        ? `Vote-Out Pick · ${voteOut}`
        : pick?.double_down === "bonus"
          ? `Play Your Advantage · ${wildCard}`
          : null;
  const rows: PointRow[] = [
    { label: "Weekly Favorite Pick", selection: favorite, points: Number(pick?.favorite_point || 0) },
    { label: "Immunity Pick", selection: immunity, points: Number(pick?.immunity_point || 0) },
    { label: "Vote-Out Pick", selection: voteOut, points: Number(pick?.boot_point || 0) },
    { label: "Play Your Advantage", selection: wildCard, points: Number(pick?.bonus_point || 0) },
  ];
  if (Number(pick?.underdog_point || 0) > 0) {
    rows.splice(1, 0, {
      label: "Underdog Bonus",
      selection: favorite,
      points: Number(pick?.underdog_point || 0),
    });
  }
  if (Number(pick?.streak_point || 0) > 0) {
    rows.push({ label: "Immunity Streak", selection: "Three correct immunity picks", points: Number(pick?.streak_point) });
  }
  if (shotSelection) {
    rows.push({ label: "Shot in the Dark", selection: shotSelection, points: Number(pick?.double_point || 0) });
  }
  if (individualGameStarted) {
    rows.push({
      label: "Opening Outlast Pick",
      selection: castawayName(individualGamePick) || "No pick on file",
      points: Number(individualGamePoints || 0),
    });
  }
  if (finale) {
    rows.push({
      label: "Final Torch Pick",
      selection: castawayName(endgamePick) || "No pick on file",
      points: Number(endgamePoints || 0),
    });
  }
  return {
    rows,
    roundPoints: rows.reduce((total, row) => total + row.points, 0),
    carriedFromEpisodeId: pick?.carried_from_episode_id || null,
  };
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

function points(value: number, signed = false) {
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${signed && value > 0 ? "+" : ""}${formatted} ${Math.abs(value) === 1 ? "point" : "points"}`;
}

export type MailRound = { episodeId: number; points: number; rank: number };

export function buildResultsRecapEmail({
  playerName, teamName, rounds, overallRank, overallPoints, overallLeaders, leagueUrl,
}: {
  playerName: string;
  teamName: string;
  rounds: MailRound[];
  overallRank: number | null;
  overallPoints: number;
  overallLeaders: RankedScore[];
  leagueUrl: string;
}) {
  const campName = teamName || playerName;
  const preseason = overallRank === null;
  const subject = `Tree Mail · Outlast 51 ${preseason ? "players to watch" : "Monday score check"}`;
  const scoreLines = preseason ? [
    "YOUR CAMP IS READY",
    `${campName}: the season has not started. Your first scoring update arrives on the Monday after the premiere.`,
  ] : [
    "YOUR MONDAY SCORE CHECK",
    ...rounds.map(round => `Episode ${round.episodeId}: ${points(round.points, true)} · Round rank #${round.rank}`),
    ...(rounds.length ? [] : ["You joined after this week's picks locked. Your first round is still ahead."]),
    `${campName}: ${points(overallPoints)} overall · League rank #${overallRank}`,
    "",
    "AT THE TOP OF THE FANTASY LEAGUE",
    ...overallLeaders.map(row => `#${row.rank} ${row.name}: ${points(row.points)}`),
  ];
  const plainText = [
    `Hi ${firstName(playerName)},`, "", ...scoreLines, "",
    "Your next move starts at camp. Check the league for your next picks.",
    `League: ${leagueUrl}`,
    "The website's scorecards and cast status may reveal episode outcomes. Open when you are caught up.",
    "", "Unofficial Outlast 51 Family League. Contact Mike if you no longer want league emails.",
  ].join("\n");
  const previewText = "Your weekly camp dispatch and fantasy league check-in. No episode outcomes inside.";
  const html = `<!doctype html><html><body style="margin:0;background:#081912;font-family:Arial,Helvetica,sans-serif;"><div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(previewText)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px;"><table role="presentation" width="100%" style="max-width:640px;background:#f6f0df;border-radius:16px;"><tr><td style="padding:28px;background:#102a1c;border-bottom:5px solid #e16b2c;"><p style="color:#e8b44f;letter-spacing:2px;font-size:12px;">OUTLAST 51 · SPOILER-FREE</p><h1 style="margin:0;color:#fff8e7;font:700 36px Georgia,serif;">Tree Mail</h1></td></tr><tr><td style="padding:28px;color:#16291f;font-size:16px;line-height:25px;white-space:pre-wrap;overflow-wrap:anywhere;">${escapeHtml(plainText)}</td></tr></table></td></tr></table></body></html>`;
  return { subject, previewText, plainText, html };
}
