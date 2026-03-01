"use client";

import { useState } from "react";
import type { Player } from "@/data/players";
import type { TribeId } from "@/data/players";
import type { TRIBES } from "@/data/players";

interface Episode {
  id: string;
  episode_number: number;
  vote_out_lock_at: string;
  voted_out_player_id: string | null;
}

interface PicksFormProps {
  userId: string;
  players: Player[];
  inGamePlayers: Player[];
  eliminatedIds: Set<string>;
  tribes: typeof TRIBES;
  initialWinnerId: string | null;
  currentEpisode: Episode | null;
  initialVoteOutId: string | null;
  initialTribeImmunityId: TribeId | null;
}

export function PicksForm({
  userId,
  players,
  inGamePlayers,
  eliminatedIds,
  tribes,
  initialWinnerId,
  currentEpisode,
  initialVoteOutId,
  initialTribeImmunityId,
}: PicksFormProps) {
  const [winnerId, setWinnerId] = useState<string>(initialWinnerId ?? "");
  const [voteOutId, setVoteOutId] = useState<string>(initialVoteOutId ?? "");
  const [tribeImmunityId, setTribeImmunityId] = useState<TribeId | "">(initialTribeImmunityId ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          winnerId: winnerId || null,
          voteOutId: currentEpisode && voteOutId ? voteOutId : null,
          episodeId: currentEpisode?.id ?? null,
          tribeImmunityEpisodeId: currentEpisode?.id ?? null,
          tribeImmunityTribeId: tribeImmunityId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Failed to save" });
        return;
      }
      setMessage({ type: "success", text: "Picks saved." });
    } finally {
      setSaving(false);
    }
  }

  const lockTime = currentEpisode
    ? new Date(currentEpisode.vote_out_lock_at)
    : null;
  const isLocked = lockTime ? new Date() >= lockTime : false;

  const needsRepick = !initialWinnerId && eliminatedIds.size > 0;

  return (
    <form onSubmit={handleSubmit} className="survivor-card">
      <div style={{ marginBottom: "1.5rem" }}>
        {needsRepick && (
          <p className="survivor-auth__message survivor-auth__message--error" style={{ marginBottom: "0.75rem" }}>
            Your pick was voted out. Choose a new player to win (you get +1 per week they stay in).
          </p>
        )}
        <label className="survivor-auth__label" htmlFor="winner">
          {needsRepick ? "New winner pick" : "Who do you think will win? (season 50)"}
        </label>
        <select
          id="winner"
          value={winnerId}
          onChange={(e) => setWinnerId(e.target.value)}
          className="survivor-auth__input"
          required={needsRepick}
        >
          <option value="">Select a player still in the game</option>
          {inGamePlayers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({tribes[p.tribeId].name})
            </option>
          ))}
        </select>
        {inGamePlayers.length === 0 && (
          <p style={{ fontSize: "0.875rem", color: "var(--survivor-text-muted)", marginTop: "0.25rem" }}>
            No players left in the game (season over or no eliminations recorded yet).
          </p>
        )}
      </div>

      {currentEpisode && (
        <>
          <div style={{ marginBottom: "1.5rem" }}>
            <label className="survivor-auth__label">Which tribe wins immunity? (Episode {currentEpisode.episode_number})</label>
            {lockTime && (
              <span style={{ fontSize: "0.8125rem", color: "var(--survivor-text-muted)", marginLeft: "0.5rem" }}>
                Locks: {lockTime.toLocaleString()}
              </span>
            )}
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
              {(Object.keys(tribes) as TribeId[]).map((id) => (
                <label key={id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="tribeImmunity"
                    value={id}
                    checked={tribeImmunityId === id}
                    onChange={() => setTribeImmunityId(id)}
                    disabled={isLocked}
                  />
                  <span style={{ color: tribes[id].color, fontWeight: 600 }}>{tribes[id].name}</span>
                </label>
              ))}
            </div>
            {isLocked && (
              <p style={{ fontSize: "0.875rem", color: "var(--survivor-text-muted)", marginTop: "0.25rem" }}>
                Tribe immunity pick is locked for this episode.
              </p>
            )}
          </div>
          <div style={{ marginBottom: "1.5rem" }}>
            <label className="survivor-auth__label" htmlFor="voteOut">
              Who gets voted out this week? (Episode {currentEpisode.episode_number})
            {lockTime && (
              <span style={{ fontSize: "0.8125rem", color: "var(--survivor-text-muted)", marginLeft: "0.5rem" }}>
                Locks: {lockTime.toLocaleString()}
              </span>
            )}
          </label>
          <select
            id="voteOut"
            value={voteOutId}
            onChange={(e) => setVoteOutId(e.target.value)}
            className="survivor-auth__input"
            disabled={isLocked}
          >
            <option value="">Select a player</option>
            {inGamePlayers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            )            )}
          </select>
          {isLocked && (
            <p style={{ fontSize: "0.875rem", color: "var(--survivor-text-muted)", marginTop: "0.25rem" }}>
              Voting is locked for this episode.
            </p>
          )}
        </div>
        </>
      )}

      {!currentEpisode && (
        <p style={{ color: "var(--survivor-text-muted)", marginBottom: "1rem" }}>
          No upcoming episode to vote on. Check back after the next episode is added.
        </p>
      )}

      {message && (
        <p
          className={message.type === "error" ? "survivor-auth__message survivor-auth__message--error" : "survivor-auth__message survivor-auth__message--success"}
          style={{ marginBottom: "1rem" }}
        >
          {message.text}
        </p>
      )}

      <button type="submit" className="survivor-btn survivor-btn--primary" disabled={saving}>
        {saving ? "Saving…" : "Save picks"}
      </button>
    </form>
  );
}
