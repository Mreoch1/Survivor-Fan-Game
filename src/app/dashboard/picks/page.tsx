import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PicksForm } from "./PicksForm";
import { PLAYERS, TRIBES } from "@/data/players";
import type { TribeId } from "@/data/players";

const INDIVIDUAL_IMMUNITY_START_EPISODE = 7;

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
    .select("episode_number, voted_out_player_id, second_voted_out_player_id, third_voted_out_player_id, medevac_player_id")
    .eq("season", 50)
    .order("episode_number", { ascending: true });
  const eliminatedPlayerIds = new Set<string>();
  (allEpisodes ?? []).forEach((e: { voted_out_player_id?: string | null; second_voted_out_player_id?: string | null; third_voted_out_player_id?: string | null; medevac_player_id?: string | null }) => {
    if (e.voted_out_player_id) eliminatedPlayerIds.add(e.voted_out_player_id);
    if (e.second_voted_out_player_id) eliminatedPlayerIds.add(e.second_voted_out_player_id);
    if (e.third_voted_out_player_id) eliminatedPlayerIds.add(e.third_voted_out_player_id);
    if (e.medevac_player_id) eliminatedPlayerIds.add(e.medevac_player_id);
  });

  const { data: pointsRow } = await supabase
    .from("user_season_points")
    .select("points")
    .eq("user_id", user.id)
    .eq("season", 50)
    .maybeSingle();
  const userPoints = pointsRow?.points ?? 0;

  const { data: episodes } = await supabase
    .from("episodes")
    .select("id, episode_number, vote_out_lock_at, voted_out_player_id, second_voted_out_player_id, third_voted_out_player_id, medevac_player_id")
    .eq("season", 50)
    .order("episode_number", { ascending: true });

  const currentEpisode = episodes?.find((e) => !e.voted_out_player_id);
  const isIndividualImmunityPhase = (currentEpisode?.episode_number ?? 0) >= INDIVIDUAL_IMMUNITY_START_EPISODE;
  let userVoteOutPick: string | null = null;
  let userTribeImmunityPick: TribeId | null = null;
  let userIndividualImmunityPick: string | null = null;
  if (currentEpisode) {
    const { data: votePick } = await supabase
      .from("vote_out_picks")
      .select("player_id")
      .eq("user_id", user.id)
      .eq("episode_id", currentEpisode.id)
      .maybeSingle();
    userVoteOutPick = votePick?.player_id ?? null;
    if (!isIndividualImmunityPhase) {
      const { data: tribeImmPick } = await supabase
        .from("tribe_immunity_picks")
        .select("tribe_id")
        .eq("user_id", user.id)
        .eq("episode_id", currentEpisode.id)
        .maybeSingle();
      userTribeImmunityPick = (tribeImmPick?.tribe_id as TribeId) ?? null;
    } else {
      const { data: individualImmPick } = await supabase
        .from("individual_immunity_picks")
        .select("player_id")
        .eq("user_id", user.id)
        .eq("episode_id", currentEpisode.id)
        .maybeSingle();
      userIndividualImmunityPick = individualImmPick?.player_id ?? null;
    }
  }

  const inGamePlayers = PLAYERS.filter((p) => !eliminatedPlayerIds.has(p.id));

  return (
    <>
      <h1 className="survivor-card__title" style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
        My picks
      </h1>
      <p style={{ color: "var(--survivor-text-muted)", marginBottom: "0.5rem" }}>
        Pick a player to win (+1 per week they stay in, -1 when eliminated, then repick). Each week pick who gets voted out (+2 if correct). Pick tribe immunity pre-merge and individual immunity post-merge (+1 if correct). Picks lock when the episode starts.
      </p>
      <p style={{ color: "var(--survivor-accent)", fontWeight: 600, marginBottom: "1.5rem" }}>
        Your points: {userPoints}
      </p>
      <PicksForm
        inGamePlayers={inGamePlayers}
        eliminatedIds={eliminatedPlayerIds}
        tribes={TRIBES}
        initialWinnerId={winnerPick?.player_id ?? null}
        currentEpisode={currentEpisode ?? null}
        initialVoteOutId={userVoteOutPick}
        initialTribeImmunityId={userTribeImmunityPick}
        initialIndividualImmunityId={userIndividualImmunityPick}
        isIndividualImmunityPhase={isIndividualImmunityPhase}
      />
    </>
  );
}
