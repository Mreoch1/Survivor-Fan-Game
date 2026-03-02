import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPlayerById, TRIBES, getPlayerAvatarUrl, CASTAWAYS_PAGE_URL } from "@/data/players";

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const player = getPlayerById(id);
  if (!player) notFound();
  const tribe = TRIBES[player.tribeId];

  const supabase = await createClient();
  const { data: episodes } = await supabase
    .from("episodes")
    .select("episode_number")
    .eq("season", 50)
    .or(`voted_out_player_id.eq.${id},medevac_player_id.eq.${id}`)
    .order("episode_number", { ascending: true })
    .limit(1);
  const eliminatedEpisode = episodes?.[0]?.episode_number ?? null;

  return (
    <>
      <Link href="/dashboard/players" className="survivor-auth__link" style={{ marginBottom: "1rem", display: "inline-block" }}>
        ← Back to cast
      </Link>
      <div className="survivor-card">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", alignItems: "flex-start" }}>
          <div style={{ width: "200px", flexShrink: 0, position: "relative", opacity: eliminatedEpisode ? 0.7 : 1 }}>
            <div
              className="survivor-player-detail__photo"
              style={{
                aspectRatio: "3/4",
                background: "var(--survivor-bg)",
                borderRadius: "0.5rem",
                border: `2px solid ${eliminatedEpisode ? "var(--survivor-danger)" : tribe.color}`,
                overflow: "hidden",
                position: "relative",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getPlayerAvatarUrl(player)}
                alt={player.name}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              {eliminatedEpisode != null && (
                <>
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(0,0,0,0.5)",
                      pointerEvents: "none",
                    }}
                  >
                    <svg
                      viewBox="0 0 100 100"
                      style={{
                        width: "60%",
                        height: "60%",
                        stroke: "var(--survivor-danger)",
                        strokeLinecap: "round",
                        filter: "drop-shadow(0 0 4px rgba(0,0,0,0.8))",
                      }}
                      strokeWidth={8}
                    >
                      <line x1="10" y1="10" x2="90" y2="90" />
                      <line x1="90" y1="10" x2="10" y2="90" />
                    </svg>
                  </div>
                  <span
                    style={{
                      position: "absolute",
                      bottom: "0.25rem",
                      left: "0.25rem",
                      right: "0.25rem",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: "var(--survivor-bg)",
                      background: "var(--survivor-danger)",
                      padding: "0.25rem 0.5rem",
                      borderRadius: "0.25rem",
                      textAlign: "center",
                    }}
                  >
                    Eliminated — Episode {eliminatedEpisode}
                  </span>
                </>
              )}
            </div>
            <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: tribe.color, fontWeight: 600 }}>
              {tribe.name}
            </p>
          </div>
          <div style={{ flex: "1", minWidth: "200px" }}>
            <h1 className="survivor-card__title" style={{ marginBottom: "0.5rem" }}>
              {player.name}
            </h1>
            <p style={{ color: "var(--survivor-text-muted)", marginBottom: "1rem" }}>
              {player.accomplishment}
            </p>
            <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.5rem" }}>Previous seasons</h2>
            <ul style={{ color: "var(--survivor-text-muted)", lineHeight: 1.6 }}>
              {player.previousSeasons.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <p style={{ marginTop: "1rem", fontSize: "0.875rem", color: "var(--survivor-text-muted)" }}>
              Times played: {player.stats.timesPlayed} · Best finish: #{player.stats.bestFinish}
              {player.stats.isWinner && " · Winner"}
            </p>
            <p style={{ marginTop: "1rem" }}>
              <a
                href={CASTAWAYS_PAGE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="survivor-auth__link"
              >
                View on Survivor 50 Challenge →
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
