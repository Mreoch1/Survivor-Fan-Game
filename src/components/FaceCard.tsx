import Link from "next/link";
import type { Player } from "@/data/players";
import { TRIBES, getPlayerAvatarUrl } from "@/data/players";

interface FaceCardProps {
  player: Player;
  tribeColor?: string;
  /** When set, the player was eliminated this episode; card is faded and shows a red X. */
  eliminatedEpisodeNumber?: number | null;
}

export function FaceCard({ player, tribeColor, eliminatedEpisodeNumber }: FaceCardProps) {
  const tribe = TRIBES[player.tribeId];
  const color = tribeColor ?? tribe.color;
  const avatarUrl = getPlayerAvatarUrl(player);
  const eliminated = eliminatedEpisodeNumber != null;

  return (
    <Link
      href={`/dashboard/players/${player.id}`}
      className={`survivor-facecard${eliminated ? " survivor-facecard--eliminated" : ""}`}
    >
      <div
        className="survivor-facecard__image-wrap"
        style={{ aspectRatio: "3/4", background: "var(--survivor-bg-card)", position: "relative" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarUrl} alt={player.name} className="survivor-facecard__image" />
        {eliminated && (
          <>
            <div className="survivor-facecard__eliminated-overlay" aria-hidden>
              <svg viewBox="0 0 100 100" className="survivor-facecard__eliminated-x" strokeWidth={8}>
                <line x1="10" y1="10" x2="90" y2="90" />
                <line x1="90" y1="10" x2="10" y2="90" />
              </svg>
            </div>
            <span className="survivor-facecard__eliminated-label">
              Eliminated — Episode {eliminatedEpisodeNumber}
            </span>
          </>
        )}
        {!eliminated && (
          <span
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "4px",
              background: color,
            }}
          />
        )}
      </div>
      <div className="survivor-facecard__body">
        <div className="survivor-facecard__name">{player.name}</div>
        <div className="survivor-facecard__tribe">{tribe.name}</div>
        <div className="survivor-facecard__accomplishment">{player.accomplishment}</div>
      </div>
    </Link>
  );
}
