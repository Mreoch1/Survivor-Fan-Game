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
  const { data: pointsRow } = await supabase
    .from("user_season_points")
    .select("points, last_week_delta")
    .eq("user_id", user?.id)
    .eq("season", 50)
    .maybeSingle();
  const { data: tribePick } = await supabase
    .from("tribe_picks")
    .select("tribe_id")
    .eq("user_id", user?.id)
    .eq("season", 50)
    .maybeSingle();

  const { count: episodesProcessed } = await supabase
    .from("episode_points_processed")
    .select("*", { count: "exact", head: true });

  const { data: episodes } = await supabase
    .from("episodes")
    .select("episode_number, voted_out_player_id")
    .eq("season", 50)
    .order("episode_number", { ascending: true });

  const episodeResults = (episodes ?? []).map((ep) => ({
    episodeNumber: ep.episode_number,
    bootName: ep.voted_out_player_id
      ? PLAYERS.find((p) => p.id === ep.voted_out_player_id)?.name ?? "Unknown"
      : null,
  }));

  const winnerPlayer = winnerPick?.player_id
    ? PLAYERS.find((p) => p.id === winnerPick.player_id)
    : null;
  const tribe = tribePick ? TRIBES[tribePick.tribe_id as keyof typeof TRIBES] : null;
  const userPoints = pointsRow?.points ?? 0;
  const lastWeekDelta = pointsRow?.last_week_delta ?? null;
  const statusThisWeek = winnerPlayer ? "SAFE" : winnerPick ? "ELIMINATED" : null;

  return (
    <>
      <h1 className="survivor-card__title" style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
        Welcome to the island
      </h1>
      {(episodesProcessed ?? 0) === 0 && (
        <p style={{ color: "var(--survivor-text-muted)", fontSize: "0.875rem", marginBottom: "1rem" }}>
          Week 1 results pending. Once episode results are in, your points will update.
        </p>
      )}
      {profile && !profile.display_name && (
        <SetDisplayName />
      )}
      <div className="survivor-card">
        <h2 className="survivor-card__title">Your picks at a glance</h2>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          <li style={{ marginBottom: "0.75rem" }}>
            <strong>Current winner pick:</strong>{" "}
            {winnerPlayer ? (
              <Link href="/dashboard/players" className="survivor-auth__link">
                {winnerPlayer.name}
              </Link>
            ) : (
              <Link href="/dashboard/picks" className="survivor-auth__link">
                {winnerPick ? "Your pick was voted out — pick again →" : "Set your winner pick →"}
              </Link>
            )}
          </li>
          {statusThisWeek && (
            <li style={{ marginBottom: "0.75rem" }}>
              <strong>Status this week:</strong>{" "}
              <span
                style={{
                  display: "inline-block",
                  padding: "0.2rem 0.5rem",
                  borderRadius: "0.25rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  background: statusThisWeek === "SAFE" ? "var(--survivor-success)" : "var(--survivor-danger)",
                  color: "var(--survivor-bg)",
                }}
              >
                {statusThisWeek}
              </span>
            </li>
          )}
          <li style={{ marginBottom: "0.75rem" }}>
            <strong>Points this week:</strong>{" "}
            {lastWeekDelta != null ? (lastWeekDelta >= 0 ? `+${lastWeekDelta}` : lastWeekDelta) : "—"}
          </li>
          <li style={{ marginBottom: "0.75rem" }}>
            <strong>Total points:</strong>{" "}
            <span style={{ color: "var(--survivor-accent)", fontWeight: 700 }}>{userPoints}</span>
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
        <h2 className="survivor-card__title">How scoring works</h2>
        <p style={{ color: "var(--survivor-text-muted)", lineHeight: 1.6, marginBottom: "0.5rem" }}>
          Pick one castaway to win the season. Each week they survive: +1 point. If they are voted out, injured, or removed from the show: -1 point.
          After elimination (including injury/removal), you must pick a new remaining player. Picks lock when the episode starts.
        </p>
      </div>

      <div className="survivor-card">
        <h2 className="survivor-card__title">Episode results</h2>
        <p style={{ color: "var(--survivor-text-muted)", fontSize: "0.875rem", marginBottom: "0.75rem" }}>
          Official boots by episode. Scoring uses this list. Results post on a set time (e.g. Friday 9:00 AM ET).
        </p>
        {episodeResults.length === 0 ? (
          <p style={{ color: "var(--survivor-text-muted)", margin: 0 }}>No results yet.</p>
        ) : (
          <>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {episodeResults.map(({ episodeNumber, bootName }) => (
                <li key={episodeNumber} style={{ padding: "0.35rem 0", borderBottom: "1px solid var(--survivor-border)" }}>
                  <strong>Episode {episodeNumber}:</strong> Boot = {bootName ?? "—"}
                </li>
              ))}
            </ul>
            <Link href="/dashboard/results" className="survivor-auth__link" style={{ display: "inline-block", marginTop: "0.5rem" }}>
              View all results →
            </Link>
          </>
        )}
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
