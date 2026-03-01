import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const SEASON = 50;

type SeasonPointsRow = {
  user_id: string;
  season: number;
  points: number;
  survival_points: number;
  tribe_immunity_points: number;
  individual_immunity_points: number;
  weeks_survived: number;
  eliminations_hit: number;
  last_week_delta: number | null;
};

/**
 * Applies survival points for one episode: +1 for pick staying in, -1 and clear pick if voted out.
 * Idempotent per episode. Uses service-role client so all users’ rows can be updated.
 */
export async function processEpisode(
  supabase: SupabaseClient<Database>,
  episodeId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: episodeData, error: epErr } = await supabase
    .from("episodes")
    .select("id, season, voted_out_player_id")
    .eq("id", episodeId)
    .single();

  if (epErr || !episodeData) {
    return { ok: false, error: "Episode not found" };
  }

  const episode = episodeData as { id: string; season: number; voted_out_player_id: string | null };
  if (episode.season !== SEASON) {
    return { ok: false, error: "Wrong season" };
  }
  if (!episode.voted_out_player_id) {
    return { ok: false, error: "Episode has no voted_out_player_id set" };
  }

  const votedOutId = episode.voted_out_player_id;

  const { data: already } = await supabase
    .from("episode_points_processed")
    .select("episode_id")
    .eq("episode_id", episodeId)
    .maybeSingle();

  if (already) {
    return { ok: true };
  }

  const { data: picksData } = await supabase
    .from("winner_picks")
    .select("user_id, player_id")
    .eq("season", SEASON);

  const picks = (picksData ?? []) as { user_id: string; player_id: string | null }[];
  for (const pick of picks) {
    if (!pick.player_id) continue;
    const { data: existing } = await supabase
      .from("user_season_points")
      .select("survival_points, tribe_immunity_points, individual_immunity_points, weeks_survived, eliminations_hit")
      .eq("user_id", pick.user_id)
      .eq("season", SEASON)
      .maybeSingle();
    if (!existing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("user_season_points") as any).insert({
        user_id: pick.user_id,
        season: SEASON,
        points: 0,
        survival_points: 0,
        tribe_immunity_points: 0,
        individual_immunity_points: 0,
        weeks_survived: 0,
        eliminations_hit: 0,
      });
    }
  }

  for (const pick of picks) {
    if (!pick.player_id) continue;
    const { data: row } = await supabase
      .from("user_season_points")
      .select("survival_points, tribe_immunity_points, individual_immunity_points, weeks_survived, eliminations_hit")
      .eq("user_id", pick.user_id)
      .eq("season", SEASON)
      .single();

    const rowTyped = row as Pick<SeasonPointsRow, "survival_points" | "tribe_immunity_points" | "individual_immunity_points" | "weeks_survived" | "eliminations_hit"> | null;
    const survivalPoints = rowTyped?.survival_points ?? 0;
    const tribeImmunityPoints = rowTyped?.tribe_immunity_points ?? 0;
    const individualImmunityPoints = rowTyped?.individual_immunity_points ?? 0;
    const weeksSurvived = rowTyped?.weeks_survived ?? 0;
    const eliminationsHit = rowTyped?.eliminations_hit ?? 0;

    const totalPoints = (s: number, t: number, i: number) => s + t + i;

    const upsertRow = (payload: Record<string, unknown>) =>
      // Type workaround: SupabaseClient<Database> infers never for some table mutators
      (supabase.from("user_season_points") as any).upsert(payload, { onConflict: "user_id,season" });

    if (pick.player_id === votedOutId) {
      const newSurvival = survivalPoints - 1;
      await upsertRow({
        user_id: pick.user_id,
        season: SEASON,
        survival_points: newSurvival,
        tribe_immunity_points: tribeImmunityPoints,
        individual_immunity_points: individualImmunityPoints,
        points: totalPoints(newSurvival, tribeImmunityPoints, individualImmunityPoints),
        weeks_survived: 0,
        eliminations_hit: eliminationsHit + 1,
        last_week_delta: -1,
      });
      await (supabase.from("winner_picks") as any)
        .update({ player_id: null })
        .eq("user_id", pick.user_id)
        .eq("season", SEASON);
    } else {
      const newSurvival = survivalPoints + 1;
      await upsertRow({
        user_id: pick.user_id,
        season: SEASON,
        survival_points: newSurvival,
        tribe_immunity_points: tribeImmunityPoints,
        individual_immunity_points: individualImmunityPoints,
        points: totalPoints(newSurvival, tribeImmunityPoints, individualImmunityPoints),
        weeks_survived: weeksSurvived + 1,
        eliminations_hit: eliminationsHit,
        last_week_delta: 1,
      });
    }
  }

  await (supabase.from("episode_points_processed") as any).insert({ episode_id: episodeId });
  return { ok: true };
}
