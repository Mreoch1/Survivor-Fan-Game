import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PicksForm } from "./PicksForm";
import { PLAYERS, TRIBES } from "@/data/players";
import type { TribeId } from "@/data/players";

export default async function PicksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: winnerPick } = await supabase
    .from("winner_picks")
    .select("player_id")
    .eq("user_id", user.id)
    .eq("season", 50)
    .maybeSingle();

  const { data: allEpisodes } = await supabase
    .from("episodes")
    .select("voted_out_player_id")
    .eq("season", 50)
    .not("voted_out_player_id", "is", null);
  const eliminatedPlayerIds = new Set(
    (allEpisodes ?? []).map((e) => e.voted_out_player_id).filter(Boolean) as string[]
  );

  const { data: pointsRow } = await supabase
    .from("user_season_points")
    .select("points")
    .eq("user_id", user.id)
    .eq("season", 50)
    .maybeSingle();
  const userPoints = pointsRow?.points ?? 0;

  const { data: episodes } = await supabase
    .from("episodes")
    .select("id, episode_number, vote_out_lock_at, voted_out_player_id")
    .eq("season", 50)
    .order("episode_number", { ascending: true });

  const currentEpisode = episodes?.find(
    (e) => !e.voted_out_player_id
  );
  let userVoteOutPick: string | null = null;
  let userTribeImmunityPick: TribeId | null = null;
  if (currentEpisode) {
    const { data: votePick } = await supabase
      .from("vote_out_picks")
      .select("player_id")
      .eq("user_id", user.id)
      .eq("episode_id", currentEpisode.id)
      .maybeSingle();
    userVoteOutPick = votePick?.player_id ?? null;
    const { data: tribeImmPick } = await supabase
      .from("tribe_immunity_picks")
      .select("tribe_id")
      .eq("user_id", user.id)
      .eq("episode_id", currentEpisode.id)
      .maybeSingle();
    userTribeImmunityPick = (tribeImmPick?.tribe_id as TribeId) ?? null;
  }

  const inGamePlayers = PLAYERS.filter((p) => !eliminatedPlayerIds.has(p.id));

  return (
    <>
      <h1 className="survivor-card__title" style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
        My picks
      </h1>
      <p style={{ color: "var(--survivor-text-muted)", marginBottom: "0.5rem" }}>
        Pick a player to win (+1 per week they stay in, -1 when eliminated; then repick). Each week pick which tribe wins immunity (+1 if correct) and who gets voted out (+2 if correct). Picks lock when the episode starts.
      </p>
      <p style={{ color: "var(--survivor-accent)", fontWeight: 600, marginBottom: "1.5rem" }}>
        Your points: {userPoints}
      </p>
      <PicksForm
        userId={user.id}
        players={PLAYERS}
        inGamePlayers={inGamePlayers}
        eliminatedIds={eliminatedPlayerIds}
        tribes={TRIBES}
        initialWinnerId={winnerPick?.player_id ?? null}
        currentEpisode={currentEpisode ?? null}
        initialVoteOutId={userVoteOutPick}
        initialTribeImmunityId={userTribeImmunityPick}
      />
    </>
  );
}
