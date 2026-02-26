import Link from "next/link";
import type { Player } from "@/data/players";
import { TRIBES, getPlayerInitials } from "@/data/players";

interface FaceCardProps {
  player: Player;
  tribeColor?: string;
}

export function FaceCard({ player, tribeColor }: FaceCardProps) {
  const tribe = TRIBES[player.tribeId];
  const color = tribeColor ?? tribe.color;

  return (
    <Link href={`/dashboard/players/${player.id}`} className="survivor-facecard">
      <div style={{ aspectRatio: "3/4", background: "var(--survivor-bg-card)", position: "relative" }}>
        {player.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={player.imageUrl}
            alt={player.name}
            className="survivor-facecard__image"
          />
        ) : (
          <div
            className="survivor-facecard__image survivor-facecard__initials"
            style={{ background: `${color}33`, color }}
            aria-hidden
          >
            {getPlayerInitials(player.name)}
          </div>
        )}
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
      </div>
      <div className="survivor-facecard__body">
        <div className="survivor-facecard__name">{player.name}</div>
        <div className="survivor-facecard__tribe">{tribe.name}</div>
        <div className="survivor-facecard__accomplishment">{player.accomplishment}</div>
      </div>
    </Link>
  );
}
