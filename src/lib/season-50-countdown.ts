/**
 * Planned episode count for Season 50 (this group treats the season as 14 episodes through the finale).
 * Override with NEXT_PUBLIC_SEASON_50_TOTAL_EPISODES if you standardize on a different total later.
 */
export const SEASON_50 = 50;

export function getSeason50TotalEpisodes(): number {
  const raw = process.env.NEXT_PUBLIC_SEASON_50_TOTAL_EPISODES;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  if (Number.isFinite(n) && n > 0) return n;
  return 14;
}
