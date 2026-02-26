import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const SEASON = 50;

/**
 * After an episode's voted_out_player_id is set (e.g. in Supabase dashboard),
 * call this to apply survival points: +1 for users whose pick stayed in, -1 and
 * clear pick for users whose pick was voted out. Idempotent per episode.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const episodeId = typeof body.episodeId === "string" ? body.episodeId : null;
  if (!episodeId) {
    return NextResponse.json({ error: "episodeId required" }, { status: 400 });
  }

  const { data: episode, error: epErr } = await supabase
    .from("episodes")
    .select("id, season, voted_out_player_id")
    .eq("id", episodeId)
    .single();

  if (epErr || !episode) {
    return NextResponse.json({ error: "Episode not found" }, { status: 404 });
  }
  if (episode.season !== SEASON) {
    return NextResponse.json({ error: "Wrong season" }, { status: 400 });
  }
  if (!episode.voted_out_player_id) {
    return NextResponse.json({ error: "Episode has no voted_out_player_id set" }, { status: 400 });
  }

  const votedOutId = episode.voted_out_player_id;

  const { data: already } = await supabase
    .from("episode_points_processed")
    .select("episode_id")
    .eq("episode_id", episodeId)
    .maybeSingle();

  if (already) {
    return NextResponse.json({ ok: true, message: "Already processed" });
  }

  const { data: picks } = await supabase
    .from("winner_picks")
    .select("user_id, player_id")
    .eq("season", SEASON);

  const userIds = new Set<string>();
  picks?.forEach((p) => p.user_id && userIds.add(p.user_id));

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

  return NextResponse.json({ ok: true });
}
