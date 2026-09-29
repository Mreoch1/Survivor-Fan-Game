import { buildResultsRecapEmail } from "../../../../lib/recap-email";
import { buildSeasonDashboard, type SeasonEpisode, type SeasonPick, type SeasonProfile, type SeasonResult } from "../../../../lib/season-dashboard";
import { readAllRows } from "../../../../lib/read-all-rows";
import { mondayMailWindow, selectWeeklyEdition, type MailEpisode } from "../../../../lib/weekly-edition";
import { createAdminClient } from "../../../../lib/supabase/admin";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const expected = process.env.AUTO_RESULTS_SECRET || "";
  if (!supplied || !expected || supplied.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < supplied.length; i++) difference |= supplied.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}

const json = (body: unknown, status = 200) => Response.json(body, {
  status, headers: { "cache-control": "no-store" },
});

export async function GET(request: Request) {
  if (!authorized(request)) return json({ error: "Automation access required" }, 401);
  const now = new Date();
  if (!mondayMailWindow(now).open) {
    return json({ pending: false, message: "Tree Mail opens Mondays at 10 AM America/Detroit" });
  }
  const db = createAdminClient();
  // This endpoint only reads. The established results workflow owns publication.
  const episodes = await readAllRows<SeasonEpisode & MailEpisode>((from, to) => db.from("episodes")
    .select("id,title,phase,air_at,lock_at,reveal_at,bonus_question,individual_game_started,results_published")
    .eq("season", 51).order("id").range(from, to));
  const edition = selectWeeklyEdition(episodes, now);
  if (!edition.pending) return json(edition);

  const profiles = await readAllRows<SeasonProfile>((from, to) => db.from("profiles")
    .select("id,display_name,team_name,avatar_key,league_joined_at,individual_game_pick,endgame_pick,endgame_pick_switched")
    .not("league_joined_at", "is", null).order("id").range(from, to));
  if (!profiles.length) return json({ pending: false, message: "No joined players" });

  // Only the published ledger feeds totals; never expose current/hidden picks.
  const published = episodes.filter(episode => episode.results_published &&
    new Date(episode.reveal_at) <= now && new Date(episode.air_at) <= now);
  const ids = published.map(episode => episode.id);
  const [picks, results] = ids.length ? await Promise.all([
    readAllRows<SeasonPick>((from, to) => db.from("picks")
      .select("user_id,episode_id,favorite_id,immunity_pick,boot_pick,bonus_pick,double_down,carried_from_episode_id,favorite_point,immunity_point,boot_point,bonus_point,underdog_point,streak_point,double_point")
      .in("episode_id", ids).order("episode_id").order("user_id").range(from, to)),
    readAllRows<SeasonResult>((from, to) => db.from("episode_results")
      .select("episode_id,departures,immunity_void,finale_winner,finalists")
      .in("episode_id", ids).order("episode_id").range(from, to)),
  ]) : [[], []];
  const emails = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 500 });
    if (error) throw error;
    for (const user of data.users) if (user.email) emails.set(user.id, user.email);
    if (data.users.length < 500) break;
  }
  const leagueUrl = `${process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin}/play`;
  const recipients = new Set<string>();
  const players = profiles.flatMap(profile => {
    const email = emails.get(profile.id);
    if (!email) return [];
    const key = email.toLowerCase();
    if (recipients.has(key)) throw new Error("Multiple joined profiles share a recipient; resolve before mailing");
    recipients.add(key);
    const dashboard = buildSeasonDashboard({ viewerId: profile.id, profiles, episodes: published,
      picks, results, now, castawayName: () => null });
    const rounds = dashboard.history.filter(round => edition.episodeIds.includes(round.episodeId))
      .reverse().map(round => ({ episodeId: round.episodeId, points: round.points, rank: round.roundRank }));
    const overallLeaders = dashboard.overall.filter(row => row.rank <= 3)
      .map(row => ({ name: row.name, rank: row.rank, points: row.points }));
    // Deliberately whitelist totals/ranks: no titles, cast names, selections,
    // category scores, outcomes, phase changes, or spoiler-bearing highlights.
    return [{
      name: profile.display_name, teamName: profile.team_name, email,
      rounds, overallRank: dashboard.overallRank, overallPoints: dashboard.totalPoints,
      emailContent: buildResultsRecapEmail({ playerName: profile.display_name,
        teamName: profile.team_name, rounds, overallRank: dashboard.overallRank,
        overallPoints: dashboard.totalPoints, overallLeaders, leagueUrl }),
    }];
  });
  if (!players.length) return json({ pending: false, message: "No joined players have an email address" });
  return json({ ...edition, players, leagueUrl, rules: {
    sendIndividually: true, spoilersAllowed: false, scoringContentMustRemainExact: true,
    addResearchedSpoilerFreeEditorial: true,
  } });
}
