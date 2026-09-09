import { castaways } from "../../../data";
import { ensureDatabase, publishDueResults } from "../../../../db/runtime";
import {
  buildPointBreakdown,
  buildResultsRecapEmail,
  type RankedScore,
  type RecapPick,
  type ResultItem,
} from "../../../../lib/recap-email";
import { createAdminClient } from "../../../../lib/supabase/admin";

import { playerLabel } from "../../../../lib/player-label";

type Profile = {
  id: string;
  display_name: string;
  team_name: string;
  total_points: number;
  individual_game_pick: string | null;
  endgame_pick: string | null;
  individual_game_points: number;
  endgame_points: number;
  created_at: string;
};

type Departure = { castawayId?: string; type?: "vote" | "medical" | "quit" };

function authorized(request: Request) {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const expected = process.env.AUTO_RESULTS_SECRET || "";
  if (!supplied || !expected || supplied.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < supplied.length; i++) difference |= supplied.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}

function addRanks<T>(rows: T[], getPoints: (row: T) => number) {
  let rank = 0;
  let lastPoints: number | null = null;
  return rows.map((row, index) => {
    const rowPoints = getPoints(row);
    if (lastPoints !== rowPoints) rank = index + 1;
    lastPoints = rowPoints;
    return { ...row, rank };
  });
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Automation access required" }, { status: 401 });
  await ensureDatabase();
  await publishDueResults();
  const db = createAdminClient();
  const now = new Date();
  const recentCutoff = new Date(now.getTime() - 36 * 3_600_000);
  const { data: episode, error: episodeError } = await db
    .from("episodes")
    .select("id,title,phase,bonus_question,reveal_at,individual_game_started")
    .eq("results_published", true)
    .lte("reveal_at", now.toISOString())
    .gte("reveal_at", recentCutoff.toISOString())
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (episodeError) throw episodeError;
  if (!episode) {
    return Response.json({ pending: false, message: "No newly published episode is ready for a recap" });
  }

  const [resultResponse, profilesResponse, picksResponse, usersResponse] = await Promise.all([
    db
      .from("episode_results")
      .select("departures,immunity_winners,immunity_void,bonus_answer,finale_winner,finalists")
      .eq("episode_id", episode.id)
      .maybeSingle(),
    db
      .from("profiles")
      .select(
        "id,display_name,team_name,total_points,individual_game_pick,endgame_pick,individual_game_points,endgame_points,created_at",
      )
      .not("league_joined_at", "is", null)
      .order("total_points", { ascending: false })
      .order("created_at"),
    db
      .from("picks")
      .select(
        "user_id,favorite_id,immunity_pick,boot_pick,bonus_pick,double_down,carried_from_episode_id,favorite_point,immunity_point,boot_point,bonus_point,underdog_point,streak_point,double_point",
      )
      .eq("episode_id", episode.id),
    db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  if (resultResponse.error || profilesResponse.error || picksResponse.error || usersResponse.error) {
    throw resultResponse.error || profilesResponse.error || picksResponse.error || usersResponse.error;
  }
  if (!resultResponse.data) {
    return Response.json({ pending: false, message: "The published episode has no recorded results", episodeId: episode.id });
  }

  const result = resultResponse.data;
  const profiles = (profilesResponse.data || []) as Profile[];
  const picks = new Map(
    (picksResponse.data || []).map((pick) => [pick.user_id, pick as RecapPick & { user_id: string }]),
  );
  const emails = new Map(usersResponse.data.users.map((user) => [user.id, user.email || ""]));
  const castawayName = (id: string | null | undefined) =>
    castaways.find((castaway) => castaway.id === id)?.name || null;
  const outcomeName = (id: string) => (["Savu", "Toka"].includes(id) ? `${id} Tribe` : castawayName(id) || id);
  const departures = (Array.isArray(result.departures) ? result.departures : []) as Departure[];
  const immunityWinners = (Array.isArray(result.immunity_winners) ? result.immunity_winners : []).map(String);
  const finalists = (Array.isArray(result.finalists) ? result.finalists : []).map(String);
  const resultItems: ResultItem[] = [];
  for (const [type, label] of [
    ["vote", "Voted out"],
    ["medical", "Medical removal"],
    ["quit", "Quit the game"],
  ] as const) {
    const names = departures
      .filter((departure) => departure.type === type && departure.castawayId)
      .map((departure) => outcomeName(String(departure.castawayId)));
    if (names.length) resultItems.push({ label, value: names.join(" & ") });
  }
  if (!departures.length) resultItems.push({ label: "Departure", value: "No departure recorded" });
  resultItems.push({
    label: immunityWinners.length > 1 ? "Immunity winners" : "Immunity winner",
    value: immunityWinners.length ? immunityWinners.map(outcomeName).join(" & ") : "No winner recorded",
  });
  if (result.immunity_void) {
    resultItems.push({ label: "League immunity scoring", value: "Voided for this episode" });
  }
  resultItems.push({
    label: "Play Your Advantage result",
    value: `${episode.bonus_question} — ${String(result.bonus_answer)}`,
  });
  if (episode.individual_game_started) {
    resultItems.push({ label: "Individual game", value: "Officially began; Opening Outlast points awarded" });
  }
  const finaleWinner = String(result.finale_winner || "");
  if (finaleWinner) {
    resultItems.push({ label: "Sole Survivor", value: outcomeName(finaleWinner) });
    resultItems.push({
      label: "Final three",
      value: [finaleWinner, ...finalists].map(outcomeName).join(" · "),
    });
  }

  const overallRanked = addRanks(profiles, (profile) => Number(profile.total_points));
  const playerRounds = overallRanked.map((profile) => {
    const breakdown = buildPointBreakdown({
      pick: picks.get(profile.id) || null,
      phase: episode.phase as "tribe" | "individual",
      castawayName,
      individualGameStarted: Boolean(episode.individual_game_started),
      individualGamePick: profile.individual_game_pick,
      individualGamePoints: Number(profile.individual_game_points),
      finale: Boolean(finaleWinner),
      endgamePick: profile.endgame_pick,
      endgamePoints: Number(profile.endgame_points),
    });
    return { ...profile, ...breakdown, publicName: playerLabel(profile.team_name, profile.display_name) };
  });
  const roundRanked = addRanks(
    [...playerRounds].sort(
      (a, b) => b.roundPoints - a.roundPoints || Number(b.total_points) - Number(a.total_points) || a.created_at.localeCompare(b.created_at),
    ),
    (profile) => profile.roundPoints,
  );
  const overallLeaders: RankedScore[] = overallRanked
    .filter((profile) => profile.rank <= 3)
    .map((profile) => ({
      rank: profile.rank,
      name: playerLabel(profile.team_name, profile.display_name),
      points: Number(profile.total_points),
    }));
  const roundLeaders: RankedScore[] = roundRanked
    .filter((profile) => profile.rank <= 3)
    .map((profile) => ({ rank: profile.rank, name: profile.publicName, points: profile.roundPoints }));
  const overallById = new Map(overallRanked.map((profile) => [profile.id, profile]));
  const roundById = new Map(roundRanked.map((profile) => [profile.id, profile]));
  const leagueUrl = `${process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin}/play`;
  const subject = `The tribe has spoken · Outlast 51 Episode ${episode.id} results`;
  const players = playerRounds.flatMap((profile) => {
    const email = emails.get(profile.id) || "";
    const overall = overallById.get(profile.id);
    const round = roundById.get(profile.id);
    if (!email || !overall || !round) return [];
    return [
      {
        name: profile.display_name,
        teamName: profile.team_name,
        email,
        roundPoints: profile.roundPoints,
        roundRank: round.rank,
        overallRank: overall.rank,
        overallPoints: Number(profile.total_points),
        pointBreakdown: profile.rows,
        emailContent: buildResultsRecapEmail({
          playerName: profile.display_name,
          teamName: profile.team_name,
          episodeId: episode.id,
          episodeTitle: episode.title,
          resultItems,
          pointRows: profile.rows,
          roundPoints: profile.roundPoints,
          carriedFromEpisodeId: profile.carriedFromEpisodeId,
          roundRank: round.rank,
          overallRank: overall.rank,
          overallPoints: Number(profile.total_points),
          roundLeaders,
          overallLeaders,
          leagueUrl,
        }),
      },
    ];
  });
  if (!players.length) {
    return Response.json({ pending: false, message: "No joined players have an email address", episodeId: episode.id });
  }
  return Response.json({
    pending: true,
    episode: {
      id: episode.id,
      title: episode.title,
      revealAt: episode.reveal_at,
      results: resultItems,
    },
    players,
    leagueUrl,
    rules: {
      sendIndividually: true,
      spoilersAllowedAfterReveal: true,
      useExactEmailContent: true,
      subject,
    },
  });
}
