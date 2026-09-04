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
  const wildCard = pick?.bonus_pick || "No pick on file";
  const shotSelection =
    pick?.double_down === "immunity"
      ? `Immunity Pick · ${immunity}`
      : pick?.double_down === "boot"
        ? `Vote-Out Pick · ${voteOut}`
        : pick?.double_down === "bonus"
          ? `Wild Card Pick · ${wildCard}`
          : null;
  const rows: PointRow[] = [
    { label: "Weekly Favorite Pick", selection: favorite, points: Number(pick?.favorite_point || 0) },
    { label: "Immunity Pick", selection: immunity, points: Number(pick?.immunity_point || 0) },
    { label: "Vote-Out Pick", selection: voteOut, points: Number(pick?.boot_point || 0) },
    { label: "Wild Card Pick", selection: wildCard, points: Number(pick?.bonus_point || 0) },
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
  return `${signed && value > 0 ? "+" : ""}${formatted} ${value === 1 ? "point" : "points"}`;
}

function scoreRows(rows: RankedScore[]) {
  return rows
    .map(
      (row) =>
        `<tr><td style="padding:7px 0;border-bottom:1px solid #385343;color:#e8e0ca;font-size:14px;line-height:20px;"><span style="display:inline-block;width:30px;color:#e8b44f;font-weight:700;">#${row.rank}</span>${escapeHtml(row.name)}</td><td align="right" style="padding:7px 0;border-bottom:1px solid #385343;color:#fff8e7;font-size:14px;line-height:20px;font-weight:700;">${escapeHtml(points(row.points))}</td></tr>`,
    )
    .join("");
}

export function buildResultsRecapEmail({
  playerName,
  teamName,
  episodeId,
  episodeTitle,
  resultItems,
  pointRows,
  roundPoints,
  carriedFromEpisodeId,
  roundRank,
  overallRank,
  overallPoints,
  roundLeaders,
  overallLeaders,
  leagueUrl,
}: {
  playerName: string;
  teamName: string;
  episodeId: number;
  episodeTitle: string;
  resultItems: ResultItem[];
  pointRows: PointRow[];
  roundPoints: number;
  carriedFromEpisodeId: number | null;
  roundRank: number;
  overallRank: number;
  overallPoints: number;
  roundLeaders: RankedScore[];
  overallLeaders: RankedScore[];
  leagueUrl: string;
}) {
  const campName = teamName || playerName;
  const subject = `The tribe has spoken · Outlast 51 Episode ${episodeId} results`;
  const resultLines = resultItems.map((item) => `${item.label}: ${item.value}`);
  const pointLines = pointRows.map((row) => `${row.label} — ${row.selection}: ${points(row.points, true)}`);
  const roundLeaderLines = roundLeaders.map((row) => `#${row.rank} ${row.name}: ${points(row.points)}`);
  const overallLeaderLines = overallLeaders.map((row) => `#${row.rank} ${row.name}: ${points(row.points)}`);
  const carryLine = carriedFromEpisodeId ? `Your eligible weekly picks were carried forward from Episode ${carriedFromEpisodeId}.` : null;
  const plainText = [
    `OUTLAST 51 · EPISODE ${episodeId} RESULTS`,
    "SPOILERS AHEAD — RESULTS ARE PUBLISHED",
    "",
    `Hi ${firstName(playerName)},`,
    "",
    `The tribe has spoken. ${campName} scored ${points(roundPoints)} this round and finished #${roundRank}.`,
    carryLine,
    "",
    "EPISODE RESULTS",
    ...resultLines,
    "",
    "YOUR POINTS",
    ...pointLines,
    `Episode total: ${points(roundPoints, true)}`,
    "",
    "ROUND LEADERS",
    ...roundLeaderLines,
    "",
    `OVERALL STANDING — #${overallRank} · ${points(overallPoints)}`,
    ...overallLeaderLines,
    "",
    `See the full standings and make your next picks: ${leagueUrl}`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
  const resultRows = resultItems
    .map(
      (item) =>
        `<tr><td style="padding:9px 0;border-bottom:1px solid #d8cfb8;color:#655e50;font-size:13px;line-height:18px;">${escapeHtml(item.label)}</td><td align="right" style="padding:9px 0 9px 16px;border-bottom:1px solid #d8cfb8;color:#16291f;font-size:14px;line-height:19px;font-weight:700;">${escapeHtml(item.value)}</td></tr>`,
    )
    .join("");
  const breakdownRows = pointRows
    .map(
      (row) =>
        `<tr><td style="padding:9px 0;border-bottom:1px solid #d8cfb8;color:#16291f;font-size:14px;line-height:19px;"><strong>${escapeHtml(row.label)}</strong><br><span style="color:#6f685c;font-size:12px;">${escapeHtml(row.selection)}</span></td><td align="right" style="padding:9px 0 9px 16px;border-bottom:1px solid #d8cfb8;color:${row.points > 0 ? "#a94620" : "#777064"};font-size:15px;line-height:20px;font-weight:700;">${escapeHtml(points(row.points, true))}</td></tr>`,
    )
    .join("");
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#081912;font-family:Arial,Helvetica,sans-serif;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(playerName)}, you scored ${escapeHtml(points(roundPoints))} in Episode ${episodeId}.</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#081912;"><tr><td align="center" style="padding:28px 12px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#f6f0df;border:1px solid #49604e;border-radius:18px;overflow:hidden;"><tr><td style="padding:12px 34px;background:#8d2f24;color:#fff7e9;font-size:12px;line-height:16px;font-weight:700;letter-spacing:1.5px;text-align:center;">SPOILERS AHEAD · RESULTS ARE PUBLISHED</td></tr><tr><td style="padding:28px 34px;background:#102a1c;border-bottom:5px solid #e16b2c;"><p style="margin:0 0 10px;color:#e8b44f;font-size:12px;line-height:16px;font-weight:700;letter-spacing:2px;">OUTLAST 51 · EPISODE ${episodeId}</p><h1 style="margin:0;color:#fff8e7;font-family:Georgia,serif;font-size:36px;line-height:41px;font-weight:700;">The tribe has spoken.</h1><p style="margin:13px 0 0;color:#d9e3da;font-size:15px;line-height:22px;">${escapeHtml(episodeTitle)}</p></td></tr><tr><td style="padding:28px 34px 12px;"><p style="margin:0 0 16px;color:#1d2b23;font-size:16px;line-height:24px;">Hi ${escapeHtml(firstName(playerName))}, here is the official league scoring report for ${escapeHtml(campName)}.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#e9dfc8;border-radius:12px;"><tr><td align="center" style="padding:20px 12px;"><p style="margin:0 0 4px;color:#7e3e20;font-size:12px;font-weight:700;letter-spacing:1.5px;">YOUR ROUND</p><p style="margin:0;color:#163122;font-family:Georgia,serif;font-size:34px;line-height:40px;font-weight:700;">${escapeHtml(points(roundPoints, true))}</p><p style="margin:4px 0 0;color:#655e50;font-size:13px;">Round rank #${roundRank}</p></td></tr></table>${carryLine ? `<p style="margin:12px 0 0;color:#6f685c;font-size:12px;line-height:18px;">${escapeHtml(carryLine)}</p>` : ""}</td></tr><tr><td style="padding:20px 34px 8px;"><p style="margin:0 0 8px;color:#8b4e23;font-size:12px;font-weight:700;letter-spacing:1.5px;">EPISODE RESULTS</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${resultRows}</table></td></tr><tr><td style="padding:24px 34px 8px;"><p style="margin:0 0 8px;color:#8b4e23;font-size:12px;font-weight:700;letter-spacing:1.5px;">YOUR POINTS</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${breakdownRows}<tr><td style="padding:13px 0;color:#16291f;font-size:15px;font-weight:700;">Episode total</td><td align="right" style="padding:13px 0;color:#a94620;font-size:17px;font-weight:700;">${escapeHtml(points(roundPoints, true))}</td></tr></table></td></tr><tr><td style="padding:24px 34px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#102a1c;border-radius:12px;"><tr><td width="50%" valign="top" style="padding:18px 18px 18px 20px;border-right:1px solid #385343;"><p style="margin:0 0 9px;color:#e8b44f;font-size:12px;font-weight:700;letter-spacing:1.3px;">ROUND LEADERS</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${scoreRows(roundLeaders)}</table></td><td width="50%" valign="top" style="padding:18px 20px 18px 18px;"><p style="margin:0 0 9px;color:#e8b44f;font-size:12px;font-weight:700;letter-spacing:1.3px;">OVERALL · YOU ARE #${overallRank}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${scoreRows(overallLeaders)}</table></td></tr></table></td></tr><tr><td align="center" style="padding:2px 34px 30px;"><a href="${escapeHtml(leagueUrl)}" style="display:inline-block;background:#e16b2c;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:14px 24px;border-radius:999px;">See standings &amp; make next picks</a></td></tr><tr><td style="padding:18px 34px 24px;background:#e9dfc8;color:#655e50;font-size:12px;line-height:18px;">This report uses the published Outlast 51 league results and scoring only. Contact Mike if you no longer want league emails.</td></tr></table></td></tr></table></body></html>`;
  return {
    subject,
    previewText: `${playerName}, you scored ${points(roundPoints)} in Episode ${episodeId}.`,
    plainText,
    html,
  };
}
