// Commissioner-approved, one-time allowance for the two missed opening picks.
// Server-only callers; no account identifiers are sent to the player interface.
const players = new Set(["26cc4460-c662-4aaa-84f4-9116c0afaba1", "26598461-d2d2-4ee8-9fef-194f0042d5d0"]);
const hardStop = Date.parse("2026-09-30T23:00:00Z");

export function getOpeningPickGrace(userId: string, openingPick: string | null, episode: { id: number; lock_at: string; results_posted: boolean } | null, now = Date.now()) {
  if (!players.has(userId) || openingPick !== null || !episode || episode.id !== 2 || episode.results_posted) return null;
  const lock = Date.parse(episode.lock_at);
  if (!Number.isFinite(lock) || !Number.isFinite(now)) return null;
  const deadline = Math.min(lock, hardStop);
  return now < deadline ? { closesAt: new Date(deadline).toISOString() } : null;
}
