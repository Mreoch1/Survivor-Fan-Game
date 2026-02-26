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

  const { data: tribePick } = await supabase
    .from("tribe_picks")
    .select("tribe_id")
    .eq("user_id", user.id)
    .eq("season", 50)
    .maybeSingle();

  const { data: episodes } = await supabase
    .from("episodes")
    .select("id, episode_number, vote_out_lock_at, voted_out_player_id")
    .eq("season", 50)
    .order("episode_number", { ascending: true });

  const currentEpisode = episodes?.find(
    (e) => !e.voted_out_player_id
  );
  let userVoteOutPick: string | null = null;
  if (currentEpisode) {
    const { data: votePick } = await supabase
      .from("vote_out_picks")
      .select("player_id")
      .eq("user_id", user.id)
      .eq("episode_id", currentEpisode.id)
      .maybeSingle();
    userVoteOutPick = votePick?.player_id ?? null;
  }

  return (
    <>
      <h1 className="survivor-card__title" style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
        My picks
      </h1>
      <p style={{ color: "var(--survivor-text-muted)", marginBottom: "1.5rem" }}>
        Set your winner, tribe, and weekly vote-out prediction. Winner and tribe are locked once set (per season rules).
      </p>
      <PicksForm
        userId={user.id}
        players={PLAYERS}
        tribes={TRIBES}
        initialWinnerId={winnerPick?.player_id ?? null}
        initialTribeId={(tribePick?.tribe_id as TribeId) ?? null}
        currentEpisode={currentEpisode ?? null}
        initialVoteOutId={userVoteOutPick}
      />
    </>
  );
}
