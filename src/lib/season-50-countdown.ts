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

/**
 * Human-readable span of episode numbers still on the calendar (episode `total` is the finale).
 */
export function formatSeason50RemainingScheduleLabel(total: number, remaining: number): string | null {
  if (remaining <= 0) return null;
  const first = total - remaining + 1;
  if (first > total) return null;
  if (remaining === 1) {
    return `Finale week: episode ${total} is the last one on this plan.`;
  }
  return `Still on the calendar: episodes ${first}-${total} (episode ${total} is the finale).`;
}
