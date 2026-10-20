import { castaways } from "../app/data";
import { createAdminClient } from "../lib/supabase/admin";
import { buildCastDepartures } from "../lib/cast-status";
import { BASELINE_TRIBE_STATE, sameTribeState, validateTribeState, type TribeState } from "../lib/tribes";

type PublishedEpisode = { id: number; title: string; reveal_at: string; results_published: boolean; individual_game_started: boolean };
type SnapshotRow = { after_episode_id: number; phase: "tribe" | "individual"; tribes: TribeState["tribes"]; assignments: TribeState["assignments"]; sources: string[] };
const columns = "after_episode_id,phase,tribes,assignments,sources";
const asState = (row: SnapshotRow): TribeState => ({ afterEpisodeId: row.after_episode_id, phase: row.phase, tribes: row.tribes, assignments: row.assignments, sources: row.sources });

async function visibleEpisodes(now = new Date(), beforeEpisodeId?: number) {
  let query = createAdminClient().from("episodes").select("id,title,reveal_at,results_published,individual_game_started")
    .eq("season", 51).eq("results_published", true).lte("reveal_at", now.toISOString()).order("id");
  if (beforeEpisodeId !== undefined) query = query.lt("id", beforeEpisodeId);
  const { data, error } = await query;
  if (error) throw error;
  // Enforce visibility in memory too: never trust an accidental wider query to reveal a future swap.
  return (data || []).filter(row => row.results_published === true && Date.parse(row.reveal_at) <= now.getTime() &&
    (beforeEpisodeId === undefined || row.id < beforeEpisodeId)) as PublishedEpisode[];
}

async function stateForEpisodes(episodes: PublishedEpisode[]): Promise<TribeState> {
  const ids = episodes.map(episode => episode.id);
  // Always query the snapshot table, even before the season, so a missing migration fails visibly.
  const { data, error } = await createAdminClient().from("tribe_snapshots").select(columns)
    .in("after_episode_id", ids.length ? ids : [-1]).order("after_episode_id", { ascending: false });
  if (error) throw error;
  const row = (data || []).find(snapshot => ids.includes(snapshot.after_episode_id));
  return row ? asState(row as SnapshotRow) : structuredClone(BASELINE_TRIBE_STATE);
}

/** State available before picks for an episode; snapshots for that episode are excluded. */
export async function loadTribeState(beforeEpisodeId?: number): Promise<TribeState> {
  return stateForEpisodes(await visibleEpisodes(new Date(), beforeEpisodeId));
}

/** Revealed outcome state may include the swap that occurred during this exact episode. */
export async function loadTribeOutcomeState(episodeId: number): Promise<TribeState> {
  return loadTribeState(episodeId + 1);
}

export async function loadTribeContext(now = new Date()) {
  const db = createAdminClient();
  const episodes = await visibleEpisodes(now);
  const target = episodes.at(-1) || null;
  const current = await stateForEpisodes(episodes);
  const previous = target ? await stateForEpisodes(episodes.filter(episode => episode.id < target.id)) : current;
  const { data: results, error } = episodes.length ? await db.from("episode_results").select("episode_id,departures")
    .in("episode_id", episodes.map(episode => episode.id)).order("episode_id") : { data: [], error: null };
  if (error) throw error;
  const departures = buildCastDepartures({ episodes, results: results || [], now, castawayIds: castaways.map(castaway => castaway.id) });
  return {
    target: target ? { afterEpisodeId: target.id, title: target.title, revealAt: target.reveal_at,
      individualGameStarted: episodes.some(episode => episode.individual_game_started) } : null,
    castaways: castaways.map(castaway => ({ id: castaway.id, name: castaway.name,
      tribe: current.assignments[castaway.id], status: departures.has(castaway.id) ? "eliminated" : "active",
      departedAfterEpisodeId: departures.get(castaway.id)?.episodeId || null })),
    existingSnapshot: target && current.afterEpisodeId === target.id ? current : null,
    previousSnapshot: previous,
    expectedPreviousAfterEpisodeId: previous.afterEpisodeId,
  };
}

export async function saveTribeState(input: unknown, expectedPreviousAfterEpisodeId: unknown) {
  const context = await loadTribeContext();
  if (!context.target) return { ok: false as const, status: 409, error: "No published episode is ready for a tribe update" };
  if (!input || typeof input !== "object" || (input as { afterEpisodeId?: unknown }).afterEpisodeId !== context.target.afterEpisodeId) {
    return { ok: false as const, status: 409, error: "The published episode changed; reload tribe context" };
  }
  if (expectedPreviousAfterEpisodeId !== context.expectedPreviousAfterEpisodeId) {
    return { ok: false as const, status: 409, error: "The previous tribe snapshot changed; reload tribe context" };
  }
  let state: TribeState;
  try {
    state = validateTribeState(input, {
      castIds: castaways.map(castaway => castaway.id), previousState: context.previousSnapshot,
      activeCastIds: context.castaways.filter(castaway => castaway.status === "active").map(castaway => castaway.id),
      latestDepartureIds: context.castaways.filter(castaway => castaway.departedAfterEpisodeId === context.target!.afterEpisodeId).map(castaway => castaway.id),
      individualGameStarted: context.target.individualGameStarted,
    });
  } catch (error) { return { ok: false as const, status: 400, error: error instanceof Error ? error.message : "Invalid tribe state" }; }
  if (context.existingSnapshot) {
    if (!sameTribeState(context.existingSnapshot, state)) return { ok: false as const, status: 409, error: "That episode already has a different verified tribe snapshot" };
    return { ok: true as const, updated: false, state: context.existingSnapshot };
  }
  // The transaction repeats the target/previous checks under a lock, then inserts once.
  const { data, error } = await createAdminClient().rpc("record_tribe_snapshot", {
    p_after_episode_id: state.afterEpisodeId, p_expected_previous_episode_id: context.expectedPreviousAfterEpisodeId,
    p_phase: state.phase, p_tribes: state.tribes, p_assignments: state.assignments, p_sources: state.sources,
  });
  if (error) {
    if (error.code === "40001" || error.code === "23505") return { ok: false as const, status: 409, error: "Tribe state changed during submission; reload context before retrying" };
    throw error;
  }
  const saved = await loadTribeOutcomeState(state.afterEpisodeId);
  if (!sameTribeState(saved, state)) throw new Error("The saved tribe snapshot could not be verified");
  return { ok: true as const, updated: data === true, state: saved };
}
