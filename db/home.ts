import { createAdminClient } from "../lib/supabase/admin";
import { getPickCompletion } from "../lib/pick-form";
import { loadSeasonDashboard } from "./season";

export type HomeEpisode = { id: number; title: string; lockAt: string; revealAt: string };
export type HomeSummary = {
  loadedAt: number;
  joined: boolean;
  displayName: string;
  episode: HomeEpisode | null;
  pickStatus: "missing" | "incomplete" | "carried" | "saved";
  selectedCount: number;
  requiredCount: number;
  carriedFromEpisodeId: number | null;
  updatedAt: string | null;
  standings: { name: string; points: number; rank: number; isYou: boolean }[];
  totalPoints: number;
  rank: number | null;
  latestScoredEpisode: number | null;
};

// The home screen receives status and published totals, never another player's selections.
export async function loadHomeSummary(userId: string | null): Promise<HomeSummary> {
  const db = createAdminClient();
  const loadedAt = Date.now();
  const [next, pending, membership] = await Promise.all([
    db.from("episodes").select("id,title,lock_at,reveal_at").eq("results_posted", false).order("id").limit(1).maybeSingle(),
    db.from("episodes").select("id,title,lock_at,reveal_at").eq("results_posted", true).eq("results_published", false).gt("reveal_at", new Date(loadedAt).toISOString()).order("id").limit(1).maybeSingle(),
    userId ? db.from("profiles").select("display_name,league_joined_at,individual_game_pick").eq("id", userId).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (next.error || pending.error || membership.error) throw next.error || pending.error || membership.error;
  // A pending spoiler window blocks next-episode submissions, just as /api/picks does.
  const episode = pending.data || next.data;
  const home: HomeSummary = {
    loadedAt,
    joined: Boolean(membership.data?.league_joined_at), displayName: membership.data?.display_name || "",
    episode: episode ? { id: episode.id, title: episode.title, lockAt: episode.lock_at, revealAt: episode.reveal_at } : null,
    pickStatus: "missing", selectedCount: 0, requiredCount: 3, carriedFromEpisodeId: null, updatedAt: null,
    standings: [], totalPoints: 0, rank: null, latestScoredEpisode: null,
  };
  if (!home.joined || !userId) return home;
  const [saved, season] = await Promise.all([
    episode ? db.from("picks").select("favorite_id,immunity_pick,boot_pick,carried_from_episode_id,updated_at").eq("user_id", userId).eq("episode_id", episode.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    loadSeasonDashboard(userId),
  ]);
  if (saved.error) throw saved.error;
  const pick = saved.data;
  const completion = getPickCompletion({ favoriteId: pick?.favorite_id, immunityPick: pick?.immunity_pick, bootPick: pick?.boot_pick, individualGamePick: membership.data?.individual_game_pick }, episode?.id === 1);
  return {
    ...home,
    selectedCount: completion.selectedCount, requiredCount: completion.total,
    pickStatus: !pick ? "missing" : !completion.complete ? "incomplete" : pick.carried_from_episode_id != null ? "carried" : "saved",
    carriedFromEpisodeId: pick?.carried_from_episode_id ?? null, updatedAt: pick?.updated_at ?? null,
    standings: season?.overall.slice(0, 3).map(({ name, points, rank, isYou }) => ({ name, points, rank, isYou })) || [],
    totalPoints: season?.totalPoints || 0, rank: season?.overallRank ?? null, latestScoredEpisode: season?.latestPublishedEpisodeId ?? null,
  };
}
