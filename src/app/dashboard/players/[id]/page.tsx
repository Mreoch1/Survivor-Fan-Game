import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlayerById, TRIBES, getPlayerAvatarUrl } from "@/data/players";

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const player = getPlayerById(id);
  if (!player) notFound();
  const tribe = TRIBES[player.tribeId];

  return (
    <>
      <Link href="/dashboard/players" className="survivor-auth__link" style={{ marginBottom: "1rem", display: "inline-block" }}>
        ← Back to cast
      </Link>
      <div className="survivor-card">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", alignItems: "flex-start" }}>
          <div style={{ width: "200px", flexShrink: 0 }}>
            <div
              className="survivor-player-detail__photo"
              style={{
                aspectRatio: "3/4",
                background: "var(--survivor-bg)",
                borderRadius: "0.5rem",
                border: `2px solid ${tribe.color}`,
                overflow: "hidden",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getPlayerAvatarUrl(player)}
                alt={player.name}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
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
          </div>
        </div>
      </div>
    </>
  );
}
