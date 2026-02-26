import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PLAYERS, TRIBES } from "@/data/players";
import { SetDisplayName } from "./SetDisplayName";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user?.id ?? "")
    .maybeSingle();
  const { data: winnerPick } = await supabase
    .from("winner_picks")
    .select("player_id")
    .eq("user_id", user?.id)
    .eq("season", 50)
    .maybeSingle();
  const { data: tribePick } = await supabase
    .from("tribe_picks")
    .select("tribe_id")
    .eq("user_id", user?.id)
    .eq("season", 50)
    .maybeSingle();

  const winnerPlayer = winnerPick
    ? PLAYERS.find((p) => p.id === winnerPick.player_id)
    : null;
  const tribe = tribePick ? TRIBES[tribePick.tribe_id as keyof typeof TRIBES] : null;

  return (
    <>
      <h1 className="survivor-card__title" style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
        Welcome to the island
      </h1>
      {profile && !profile.display_name && (
        <SetDisplayName />
      )}
      <div className="survivor-card">
        <h2 className="survivor-card__title">Your picks at a glance</h2>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          <li style={{ marginBottom: "0.75rem" }}>
            <strong>Winner pick:</strong>{" "}
            {winnerPlayer ? (
              <Link href="/dashboard/players" className="survivor-auth__link">
                {winnerPlayer.name}
              </Link>
            ) : (
              <Link href="/dashboard/picks" className="survivor-auth__link">
                Set your winner pick →
              </Link>
            )}
          </li>
          <li style={{ marginBottom: "0.75rem" }}>
            <strong>Tribe:</strong>{" "}
            {tribe ? (
              <span style={{ color: tribe.color }}>{tribe.name}</span>
            ) : (
              <Link href="/dashboard/picks" className="survivor-auth__link">
                Choose your tribe →
              </Link>
            )}
          </li>
        </ul>
        <div style={{ marginTop: "1rem" }}>
          <Link href="/dashboard/picks" className="survivor-btn survivor-btn--primary">
            Edit my picks
          </Link>
        </div>
      </div>
      <div className="survivor-card">
        <h2 className="survivor-card__title">Point system</h2>
        <ul style={{ color: "var(--survivor-text-muted)", lineHeight: 1.7 }}>
          <li>Correct vote-out prediction: <strong style={{ color: "var(--survivor-accent)" }}>15 pts</strong> per episode</li>
          <li>Correct season winner: <strong style={{ color: "var(--survivor-accent)" }}>100 pts</strong></li>
          <li>Your tribe has the winner: <strong style={{ color: "var(--survivor-accent)" }}>25 pts</strong></li>
          <li>Your tribe has a finalist (2nd/3rd): <strong style={{ color: "var(--survivor-accent)" }}>10 pts</strong> each</li>
        </ul>
      </div>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <Link href="/dashboard/players" className="survivor-btn survivor-btn--secondary">
          View cast
        </Link>
        <Link href="/dashboard/leaderboard" className="survivor-btn survivor-btn--secondary">
          Leaderboard
        </Link>
      </div>
    </>
  );
}
