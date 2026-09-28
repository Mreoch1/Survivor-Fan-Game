import "server-only";
import { castaways } from "../app/data";
import { createAdminClient } from "../lib/supabase/admin";
import { readAllRows } from "../lib/read-all-rows";
import { buildCastDepartures, type CastStatusEpisode, type CastStatusResult } from "../lib/cast-status";

export async function loadCastDepartures(now = new Date()) {
  const db = createAdminClient();
  const episodes = await readAllRows<CastStatusEpisode>((from, to) => db.from("episodes")
    .select("id,reveal_at,results_published")
    .eq("results_published", true).lte("reveal_at", now.toISOString()).order("id").range(from, to));
  const ids = episodes.map(episode => episode.id);
  const results = ids.length ? await readAllRows<CastStatusResult>((from, to) => db.from("episode_results")
    .select("episode_id,departures").in("episode_id", ids).order("episode_id").range(from, to)) : [];
  return buildCastDepartures({ episodes, results, now, castawayIds: castaways.map(castaway => castaway.id) });
}
