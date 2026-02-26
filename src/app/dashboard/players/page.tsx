import Link from "next/link";
import { PLAYERS, TRIBES, getPlayersByTribe, CASTAWAYS_PAGE_URL } from "@/data/players";
import type { TribeId } from "@/data/players";
import { FaceCard } from "@/components/FaceCard";

export default function PlayersPage() {
  const cila = getPlayersByTribe("cila" as TribeId);
  const kalo = getPlayersByTribe("kalo" as TribeId);
  const vatu = getPlayersByTribe("vatu" as TribeId);

  return (
    <>
      <h1 className="survivor-card__title" style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
        Survivor 50 cast
      </h1>
      <p style={{ color: "var(--survivor-text-muted)", marginBottom: "1rem" }}>
        {PLAYERS.length} returning players. Pick your winner and tribe in My picks.{" "}
        <a href={CASTAWAYS_PAGE_URL} target="_blank" rel="noopener noreferrer" className="survivor-auth__link">
          Meet the cast on Survivor 50 Challenge
        </a>
      </p>
      <div className="survivor-card" style={{ marginBottom: "1.5rem", padding: 0, overflow: "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/cast-poster.png"
          alt="Survivor 50: In the Hands of the Fans — full cast by tribe"
          className="survivor-cast-poster"
        />
      </div>
      {[
        { id: "cila" as TribeId, label: "Cila", players: cila, color: TRIBES.cila.color },
        { id: "kalo" as TribeId, label: "Kalo", players: kalo, color: TRIBES.kalo.color },
        { id: "vatu" as TribeId, label: "Vatu", players: vatu, color: TRIBES.vatu.color },
      ].map(({ id, label, players, color }) => (
        <section key={id} className="survivor-card" style={{ marginBottom: "1.5rem" }}>
          <h2 className="survivor-card__title" style={{ borderLeft: `4px solid ${color}`, paddingLeft: "0.75rem" }}>
            Tribe: {label}
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: "1rem",
            }}
          >
            {players.map((player) => (
              <FaceCard key={player.id} player={player} tribeColor={color} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
