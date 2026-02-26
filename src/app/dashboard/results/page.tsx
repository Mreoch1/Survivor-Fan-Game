import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PLAYERS } from "@/data/players";

const SEASON = 50;

export default async function ResultsPage() {
  const supabase = await createClient();

  const { data: episodes } = await supabase
    .from("episodes")
    .select("episode_number, voted_out_player_id")
    .eq("season", SEASON)
    .order("episode_number", { ascending: true });

  const results = (episodes ?? []).map((ep) => ({
    episodeNumber: ep.episode_number,
    bootName: ep.voted_out_player_id
      ? PLAYERS.find((p) => p.id === ep.voted_out_player_id)?.name ?? "Unknown"
      : null,
  }));

  return (
    <>
      <h1 className="survivor-card__title" style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
        Episode results
      </h1>
      <p style={{ color: "var(--survivor-text-muted)", marginBottom: "1.5rem" }}>
        Official boots by episode. Scoring and repicks are based on this list.
      </p>

      <div className="survivor-card">
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {results.length === 0 ? (
            <li style={{ padding: "1rem", color: "var(--survivor-text-muted)" }}>
              No episode results yet. Results are posted after each episode (e.g. Friday 9:00 AM ET).
            </li>
          ) : (
            results.map(({ episodeNumber, bootName }) => (
              <li
                key={episodeNumber}
                style={{
                  padding: "0.75rem",
                  borderBottom: "1px solid var(--survivor-border)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                }}
              >
                <strong>Episode {episodeNumber}</strong>
                <span style={{ color: bootName ? "var(--survivor-text)" : "var(--survivor-text-muted)" }}>
                  Boot = {bootName ?? "—"}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>

      <Link href="/dashboard" className="survivor-auth__link" style={{ display: "inline-block", marginTop: "1rem" }}>
        ← Back to dashboard
      </Link>
    </>
  );
}
