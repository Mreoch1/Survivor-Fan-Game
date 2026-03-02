import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PLAYERS, TRIBES, getPlayersByTribe, CASTAWAYS_PAGE_URL } from "@/data/players";
import type { TribeId } from "@/data/players";
import { FaceCard } from "@/components/FaceCard";

export default async function PlayersPage() {
  const supabase = await createClient();
  const resWithMedevac = await supabase
    .from("episodes")
    .select("episode_number, voted_out_player_id, medevac_player_id")
    .eq("season", 50)
    .order("episode_number", { ascending: true });
  const res =
    resWithMedevac.error && resWithMedevac.error.message?.includes("medevac_player_id")
      ? await supabase
          .from("episodes")
          .select("episode_number, voted_out_player_id")
          .eq("season", 50)
          .order("episode_number", { ascending: true })
      : resWithMedevac;
  const episodes = (res.data ?? []) as Array<{ episode_number: number; voted_out_player_id?: string | null; medevac_player_id?: string | null }>;

  const eliminatedByEpisode = new Map<string, number>();
  episodes.forEach((ep) => {
    if (ep.voted_out_player_id) eliminatedByEpisode.set(ep.voted_out_player_id, ep.episode_number);
    if (ep.medevac_player_id) eliminatedByEpisode.set(ep.medevac_player_id, ep.episode_number);
  });

  const cila = getPlayersByTribe("cila" as TribeId);
  const kalo = getPlayersByTribe("kalo" as TribeId);
  const vatu = getPlayersByTribe("vatu" as TribeId);

  return (
    <div className="survivor-cast-page">
      <h1 className="survivor-card__title" style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
        Survivor 50 cast
      </h1>
      <p style={{ color: "var(--survivor-text-muted)", marginBottom: "1rem" }}>
        {PLAYERS.length} returning players. Pick your winner and tribe in My picks.{" "}
        <a href={CASTAWAYS_PAGE_URL} target="_blank" rel="noopener noreferrer" className="survivor-auth__link">
          Meet the cast on Survivor 50 Challenge
        </a>
      </p>
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
              <FaceCard
                key={player.id}
                player={player}
                tribeColor={color}
                eliminatedEpisodeNumber={eliminatedByEpisode.get(player.id) ?? null}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
