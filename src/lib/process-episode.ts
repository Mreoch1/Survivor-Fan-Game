import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const SEASON = 50;

/** Points per correct vote-out pick (who gets voted out). Change to 10 if you want vote-out to weigh more. */
const POINTS_PER_CORRECT_VOTE_OUT = 2;

type SeasonPointsRow = {
  user_id: string;
  season: number;
  points: number;
  survival_points: number;
  tribe_immunity_points: number;
  individual_immunity_points: number;
  vote_out_points: number;
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
    .select("id, season, voted_out_player_id, immunity_winning_tribe_id, medevac_player_id")
    .eq("id", episodeId)
    .single();

  if (epErr || !episodeData) {
    return { ok: false, error: "Episode not found" };
  }

  const episode = episodeData as {
    id: string;
    season: number;
    voted_out_player_id: string | null;
    immunity_winning_tribe_id: string | null;
    medevac_player_id: string | null;
  };
  if (episode.season !== SEASON) {
    return { ok: false, error: "Wrong season" };
  }
  if (!episode.voted_out_player_id) {
    return { ok: false, error: "Episode has no voted_out_player_id set" };
  }

  const votedOutId = episode.voted_out_player_id;
  const eliminatedPlayerIds = [votedOutId, episode.medevac_player_id].filter(Boolean) as string[];

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
      .select("survival_points, tribe_immunity_points, individual_immunity_points, vote_out_points, weeks_survived, eliminations_hit")
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
        vote_out_points: 0,
        weeks_survived: 0,
        eliminations_hit: 0,
      });
    }
  }

  for (const pick of picks) {
    if (!pick.player_id) continue;
    const { data: row } = await supabase
      .from("user_season_points")
      .select("survival_points, tribe_immunity_points, individual_immunity_points, vote_out_points, weeks_survived, eliminations_hit")
      .eq("user_id", pick.user_id)
      .eq("season", SEASON)
      .single();

    const rowTyped = row as Pick<SeasonPointsRow, "survival_points" | "tribe_immunity_points" | "individual_immunity_points" | "vote_out_points" | "weeks_survived" | "eliminations_hit"> | null;
    const survivalPoints = rowTyped?.survival_points ?? 0;
    const tribeImmunityPoints = rowTyped?.tribe_immunity_points ?? 0;
    const individualImmunityPoints = rowTyped?.individual_immunity_points ?? 0;
    const voteOutPoints = rowTyped?.vote_out_points ?? 0;
    const weeksSurvived = rowTyped?.weeks_survived ?? 0;
    const eliminationsHit = rowTyped?.eliminations_hit ?? 0;

    const totalPoints = (s: number, t: number, i: number, v: number) => s + t + i + v;

    const upsertRow = (payload: Record<string, unknown>) =>
      // Type workaround: SupabaseClient<Database> infers never for some table mutators
      (supabase.from("user_season_points") as any).upsert(payload, { onConflict: "user_id,season" });

    if (eliminatedPlayerIds.includes(pick.player_id)) {
      const newSurvival = survivalPoints - 1;
      await upsertRow({
        user_id: pick.user_id,
        season: SEASON,
        survival_points: newSurvival,
        tribe_immunity_points: tribeImmunityPoints,
        individual_immunity_points: individualImmunityPoints,
        vote_out_points: voteOutPoints,
        points: totalPoints(newSurvival, tribeImmunityPoints, individualImmunityPoints, voteOutPoints),
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
        vote_out_points: voteOutPoints,
        points: totalPoints(newSurvival, tribeImmunityPoints, individualImmunityPoints, voteOutPoints),
        weeks_survived: weeksSurvived + 1,
        eliminations_hit: eliminationsHit,
        last_week_delta: 1,
      });
    }
  }

  // Tribe immunity: +1 for each user who picked the winning tribe this episode
  if (episode.immunity_winning_tribe_id) {
    const { data: tribeCorrectPicks } = await supabase
      .from("tribe_immunity_picks")
      .select("user_id")
      .eq("episode_id", episodeId)
      .eq("tribe_id", episode.immunity_winning_tribe_id);

    const winnerUserIds = (tribeCorrectPicks ?? []).map((r: { user_id: string }) => r.user_id);
    for (const uid of winnerUserIds) {
      const { data: row } = await supabase
        .from("user_season_points")
        .select("survival_points, tribe_immunity_points, individual_immunity_points, vote_out_points, weeks_survived, eliminations_hit, last_week_delta")
        .eq("user_id", uid)
        .eq("season", SEASON)
        .maybeSingle();

      const r = row as SeasonPointsRow | null;
      const s = r?.survival_points ?? 0;
      const t = r?.tribe_immunity_points ?? 0;
      const i = r?.individual_immunity_points ?? 0;
      const v = r?.vote_out_points ?? 0;
      const newTribe = t + 1;
      const total = s + newTribe + i + v;

      await (supabase.from("user_season_points") as any).upsert(
        {
          user_id: uid,
          season: SEASON,
          survival_points: s,
          tribe_immunity_points: newTribe,
          individual_immunity_points: i,
          vote_out_points: v,
          points: total,
          weeks_survived: r?.weeks_survived ?? 0,
          eliminations_hit: r?.eliminations_hit ?? 0,
          last_week_delta: r?.last_week_delta ?? null,
        },
        { onConflict: "user_id,season" }
      );
    }
  }

  // Vote-out pick: +POINTS_PER_CORRECT_VOTE_OUT for each user who correctly picked who got voted out
  const { data: voteOutCorrectPicks } = await supabase
    .from("vote_out_picks")
    .select("user_id")
    .eq("episode_id", episodeId)
    .eq("player_id", votedOutId);

  const voteOutWinnerIds = (voteOutCorrectPicks ?? []).map((r: { user_id: string }) => r.user_id);
  for (const uid of voteOutWinnerIds) {
    const { data: row } = await supabase
      .from("user_season_points")
      .select("survival_points, tribe_immunity_points, individual_immunity_points, vote_out_points, weeks_survived, eliminations_hit, last_week_delta")
      .eq("user_id", uid)
      .eq("season", SEASON)
      .maybeSingle();

    const r = row as SeasonPointsRow | null;
    const s = r?.survival_points ?? 0;
    const t = r?.tribe_immunity_points ?? 0;
    const i = r?.individual_immunity_points ?? 0;
    const v = r?.vote_out_points ?? 0;
    const newVoteOut = v + POINTS_PER_CORRECT_VOTE_OUT;
    const total = s + t + i + newVoteOut;

    await (supabase.from("user_season_points") as any).upsert(
      {
        user_id: uid,
        season: SEASON,
        survival_points: s,
        tribe_immunity_points: t,
        individual_immunity_points: i,
        vote_out_points: newVoteOut,
        points: total,
        weeks_survived: r?.weeks_survived ?? 0,
        eliminations_hit: r?.eliminations_hit ?? 0,
        last_week_delta: r?.last_week_delta ?? null,
      },
      { onConflict: "user_id,season" }
    );
  }

  await (supabase.from("episode_points_processed") as any).insert({ episode_id: episodeId });
  return { ok: true };
}
