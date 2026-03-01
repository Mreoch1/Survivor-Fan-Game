import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { winnerId, tribeId, episodeId, voteOutId, tribeImmunityEpisodeId, tribeImmunityTribeId } = body;

  if (winnerId) {
    const { error: upsertPickErr } = await supabase.from("winner_picks").upsert(
      { user_id: user.id, player_id: winnerId, season: 50 },
      { onConflict: "user_id,season" }
    );
    if (upsertPickErr) {
      return NextResponse.json({ error: upsertPickErr.message }, { status: 500 });
    }
    await supabase.from("user_season_points").upsert(
      { user_id: user.id, season: 50, points: 0 },
      { onConflict: "user_id,season", ignoreDuplicates: true }
    );
  }

  if (tribeId) {
    const { error: deleteErr } = await supabase
      .from("tribe_picks")
      .delete()
      .eq("user_id", user.id)
      .eq("season", 50);
    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }
    const { error: insertErr } = await supabase.from("tribe_picks").insert({
      user_id: user.id,
      tribe_id: tribeId,
      season: 50,
    });
    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
  }

  if (episodeId && voteOutId) {
    const { data: episode } = await supabase
      .from("episodes")
      .select("vote_out_lock_at")
      .eq("id", episodeId)
      .single();
    if (episode && new Date() >= new Date(episode.vote_out_lock_at)) {
      return NextResponse.json({ error: "Voting is locked for this episode" }, { status: 400 });
    }
    const { error: deleteErr } = await supabase
      .from("vote_out_picks")
      .delete()
      .eq("user_id", user.id)
      .eq("episode_id", episodeId);
    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }
    const { error: insertErr } = await supabase.from("vote_out_picks").insert({
      user_id: user.id,
      episode_id: episodeId,
      player_id: voteOutId,
    });
    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
  }

  if (tribeImmunityEpisodeId) {
    const { data: episode } = await supabase
      .from("episodes")
      .select("vote_out_lock_at")
      .eq("id", tribeImmunityEpisodeId)
      .single();
    if (episode && new Date() >= new Date(episode.vote_out_lock_at)) {
      return NextResponse.json({ error: "Tribe immunity pick is locked for this episode" }, { status: 400 });
    }
    if (tribeImmunityTribeId) {
      const { error: upsertErr } = await supabase.from("tribe_immunity_picks").upsert(
        {
          user_id: user.id,
          episode_id: tribeImmunityEpisodeId,
          tribe_id: tribeImmunityTribeId,
        },
        { onConflict: "user_id,episode_id" }
      );
      if (upsertErr) {
        return NextResponse.json({ error: upsertErr.message }, { status: 500 });
      }
    } else {
      await supabase
        .from("tribe_immunity_picks")
        .delete()
        .eq("user_id", user.id)
        .eq("episode_id", tribeImmunityEpisodeId);
    }
  }

  return NextResponse.json({ ok: true });
}
