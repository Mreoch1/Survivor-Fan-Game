/**
 * Planned episode count for Season 50 (13 episodes: episode 12, then the finale as episode 13).
 * Override with NEXT_PUBLIC_SEASON_50_TOTAL_EPISODES if the network order changes.
 */
export const SEASON_50 = 50;

export function getSeason50TotalEpisodes(): number {
  const raw = process.env.NEXT_PUBLIC_SEASON_50_TOTAL_EPISODES;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  if (Number.isFinite(n) && n > 0) return n;
  return 13;
}
