import { castaways } from "../app/data";
import type { MergeWelcomeData } from "../lib/merge-welcome";
import { createAdminClient } from "../lib/supabase/admin";

export async function loadMergeWelcome(db: ReturnType<typeof createAdminClient>, userId: string): Promise<MergeWelcomeData | null> {
  const now = Date.now();
  const event = await db.from("episodes").select("id").eq("individual_game_started", true)
    .eq("results_published", true).lte("reveal_at", new Date(now).toISOString()).maybeSingle();
  if (event.error) throw event.error;
  if (!event.data) return null;

  // Use the first following episode even after it locks. Later rounds cannot reopen this decision.
  const [next, profile] = await Promise.all([
    db.from("episodes").select("lock_at").gt("id", event.data.id).order("id").limit(1).maybeSingle(),
    db.from("profiles").select("individual_game_pick,individual_game_points,league_joined_at").eq("id", userId).maybeSingle(),
  ]);
  if (next.error || profile.error) throw next.error || profile.error;
  const repickClosesAt = next.data?.lock_at;
  if (!profile.data?.league_joined_at || !repickClosesAt || !(Date.parse(repickClosesAt) > now)) return null;

  const originalId = profile.data.individual_game_pick;
  const original = castaways.find(castaway => castaway.id === originalId);
  let originalIsActive = false;
  if (original) {
    const status = await db.from("cast_status").select("status").eq("castaway_id", original.id).maybeSingle();
    if (status.error) throw status.error;
    originalIsActive = (status.data?.status ?? "active") === "active";
  }
  return { originalName: original?.name ?? null, originalIsActive, individualGamePoints: profile.data.individual_game_points ?? 0, repickClosesAt };
}
