import { castaways } from "../app/data";
import { createAdminClient } from "../lib/supabase/admin";
import { readAllRows } from "../lib/read-all-rows";
import { buildSeasonDashboard, type SeasonEpisode, type SeasonPick, type SeasonProfile, type SeasonResult } from "../lib/season-dashboard";
import { publishDueResults } from "./runtime";

export async function loadSeasonDashboard(viewerId: string) {
  const db = createAdminClient();
  const membership = await db.from("profiles").select("id").eq("id", viewerId).not("league_joined_at", "is", null).maybeSingle();
  if (membership.error) throw membership.error;
  if (!membership.data) return null;
  await publishDueResults();
  const now = new Date();
  const [profiles, episodes] = await Promise.all([
    readAllRows<SeasonProfile>((from, to) => db.from("profiles")
      .select("id,display_name,team_name,avatar_key,league_joined_at,individual_game_pick,endgame_pick,endgame_pick_switched")
      .not("league_joined_at", "is", null).order("id").range(from, to)),
    readAllRows<SeasonEpisode>((from, to) => db.from("episodes")
      .select("id,title,phase,lock_at,reveal_at,bonus_question,individual_game_started,results_published")
      .eq("results_published", true).lte("reveal_at", now.toISOString()).order("id").range(from, to)),
  ]);
  const ids = episodes.map(episode => episode.id);
  const [picks, results] = ids.length ? await Promise.all([
    readAllRows<SeasonPick>((from, to) => db.from("picks")
      .select("user_id,episode_id,favorite_id,immunity_pick,boot_pick,bonus_pick,double_down,carried_from_episode_id,favorite_point,immunity_point,boot_point,bonus_point,underdog_point,streak_point,double_point")
      .in("episode_id", ids).order("episode_id").order("user_id").range(from, to)),
    readAllRows<SeasonResult>((from, to) => db.from("episode_results")
      .select("episode_id,departures,immunity_void,finale_winner,finalists")
      .in("episode_id", ids).order("episode_id").range(from, to)),
  ]) : [[], []];
  return buildSeasonDashboard({ viewerId, profiles, episodes, picks, results, now,
    castawayName: id => castaways.find(castaway => castaway.id === id)?.name || null });
}
