import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const SEASON = 50;

/**
 * Applies survival points for one episode: +1 for pick staying in, -1 and clear pick if voted out.
 * Idempotent per episode. Uses service-role client so all users’ rows can be updated.
 */
export async function processEpisode(
  supabase: SupabaseClient<Database>,
  episodeId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: episode, error: epErr } = await supabase
    .from("episodes")
    .select("id, season, voted_out_player_id")
    .eq("id", episodeId)
    .single();

  if (epErr || !episode) {
    return { ok: false, error: "Episode not found" };
  }
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

  const { data: picks } = await supabase
    .from("winner_picks")
    .select("user_id, player_id")
    .eq("season", SEASON);

  for (const pick of picks ?? []) {
    if (!pick.player_id) continue;
    const { data: existing } = await supabase
      .from("user_season_points")
      .select("points, weeks_survived, eliminations_hit")
      .eq("user_id", pick.user_id)
      .eq("season", SEASON)
      .maybeSingle();
    if (!existing) {
      await supabase.from("user_season_points").insert({
        user_id: pick.user_id,
        season: SEASON,
        points: 0,
        weeks_survived: 0,
        eliminations_hit: 0,
      });
    }
  }

  for (const pick of picks ?? []) {
    if (!pick.player_id) continue;
    const { data: row } = await supabase
      .from("user_season_points")
      .select("points, weeks_survived, eliminations_hit")
      .eq("user_id", pick.user_id)
      .eq("season", SEASON)
      .single();

    const points = row?.points ?? 0;
    const weeksSurvived = row?.weeks_survived ?? 0;
    const eliminationsHit = row?.eliminations_hit ?? 0;

    if (pick.player_id === votedOutId) {
      await supabase
        .from("user_season_points")
        .upsert(
          {
            user_id: pick.user_id,
            season: SEASON,
            points: points - 1,
            weeks_survived: 0,
            eliminations_hit: eliminationsHit + 1,
            last_week_delta: -1,
          },
          { onConflict: "user_id,season" }
        );
      await supabase
        .from("winner_picks")
        .update({ player_id: null })
        .eq("user_id", pick.user_id)
        .eq("season", SEASON);
    } else {
      await supabase
        .from("user_season_points")
        .upsert(
          {
            user_id: pick.user_id,
            season: SEASON,
            points: points + 1,
            weeks_survived: weeksSurvived + 1,
            eliminations_hit: eliminationsHit,
            last_week_delta: 1,
          },
          { onConflict: "user_id,season" }
        );
    }
  }

  await supabase.from("episode_points_processed").insert({ episode_id: episodeId });
  return { ok: true };
}
