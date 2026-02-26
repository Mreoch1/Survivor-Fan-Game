import { createClient } from "@/lib/supabase/server";
import { PLAYERS } from "@/data/players";

const SEASON = 50;

export default async function LeaderboardPage() {
  const supabase = await createClient();

  const { data: pointsRows } = await supabase
    .from("user_season_points")
    .select("user_id, points, weeks_survived, eliminations_hit, last_week_delta")
    .eq("season", SEASON)
    .order("points", { ascending: false });

  const { data: picks } = await supabase
    .from("winner_picks")
    .select("user_id, player_id")
    .eq("season", SEASON);

  const userIds = new Set<string>();
  pointsRows?.forEach((r) => userIds.add(r.user_id));
  picks?.forEach((p) => userIds.add(p.user_id));

  const { data: profiles } =
    userIds.size > 0
      ? await supabase.from("profiles").select("id, display_name, email").in("id", Array.from(userIds))
      : { data: [] };

  const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);
  const pointsMap = new Map(pointsRows?.map((r) => [r.user_id, r]) ?? []);
  const pickMap = new Map(picks?.map((p) => [p.user_id, p]) ?? []);

  const rows = Array.from(userIds).map((userId) => {
    const pts = pointsMap.get(userId);
    const pick = pickMap.get(userId);
    const profile = profileMap.get(userId);
    const currentPickId = pick?.player_id ?? null;
    const currentPick = currentPickId ? PLAYERS.find((p) => p.id === currentPickId) : null;
    const name = profile?.display_name || profile?.email || "Player";
    const status = currentPickId ? "SAFE" : "OUT – REPICK REQUIRED";
    return {
      userId,
      name,
      currentPick: currentPick?.name ?? "—",
      weeksSurvived: pts?.weeks_survived ?? 0,
      eliminationsHit: pts?.eliminations_hit ?? 0,
      points: pts?.points ?? 0,
      lastWeekDelta: pts?.last_week_delta ?? null,
      status,
    };
  });

  rows.sort((a, b) => b.points - a.points);

  const { count: episodesProcessed } = await supabase
    .from("episode_points_processed")
    .select("*", { count: "exact", head: true });

  return (
    <>
      <h1 className="survivor-card__title" style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
        Leaderboard
      </h1>

      <section className="survivor-card" style={{ marginBottom: "1.5rem" }}>
        <h2 className="survivor-card__title" style={{ fontSize: "1.125rem", marginBottom: "0.75rem" }}>
          Point system
        </h2>
        <ul style={{ color: "var(--survivor-text-muted)", lineHeight: 1.7, margin: 0, paddingLeft: "1.25rem" }}>
          <li>+1 point each week your winner pick is still in the game</li>
          <li>-1 point the week your winner pick is voted out</li>
          <li>You must pick a new winner from remaining players after elimination</li>
          <li>If you do not repick in time, you score 0 points until you do</li>
          <li>Picks lock at episode start</li>
        </ul>
      </section>

      <div className="survivor-card" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--survivor-border)" }}>
              <th style={{ textAlign: "left", padding: "0.75rem" }}>Rank</th>
              <th style={{ textAlign: "left", padding: "0.75rem" }}>Player</th>
              <th style={{ textAlign: "left", padding: "0.75rem" }}>Status</th>
              <th style={{ textAlign: "left", padding: "0.75rem" }}>Current pick</th>
              <th style={{ textAlign: "right", padding: "0.75rem" }}>Weeks survived</th>
              <th style={{ textAlign: "right", padding: "0.75rem" }}>Eliminations hit</th>
              <th style={{ textAlign: "right", padding: "0.75rem" }}>Total points</th>
              <th style={{ textAlign: "left", padding: "0.75rem" }}>Last week</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.userId} style={{ borderBottom: "1px solid var(--survivor-border)" }}>
                <td style={{ padding: "0.75rem" }}>{i + 1}</td>
                <td style={{ padding: "0.75rem", fontWeight: 600 }}>{row.name}</td>
                <td style={{ padding: "0.75rem" }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "0.25rem 0.5rem",
                      borderRadius: "0.25rem",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      background: row.status === "SAFE" ? "var(--survivor-success)" : "var(--survivor-danger)",
                      color: "var(--survivor-bg)",
                    }}
                  >
                    {row.status}
                  </span>
                </td>
                <td style={{ padding: "0.75rem", color: "var(--survivor-text-muted)" }}>{row.currentPick}</td>
                <td style={{ padding: "0.75rem", textAlign: "right" }}>{row.weeksSurvived}</td>
                <td style={{ padding: "0.75rem", textAlign: "right" }}>{row.eliminationsHit}</td>
                <td style={{ padding: "0.75rem", textAlign: "right", color: "var(--survivor-accent)", fontWeight: 700 }}>
                  {row.points}
                </td>
                <td style={{ padding: "0.75rem", color: "var(--survivor-text-muted)", fontSize: "0.875rem" }}>
                  {row.lastWeekDelta != null
                    ? row.lastWeekDelta >= 0
                      ? `+${row.lastWeekDelta}`
                      : row.lastWeekDelta
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p style={{ color: "var(--survivor-text-muted)", padding: "1rem" }}>
            No points yet. Make your winner pick to start earning.
          </p>
        )}
      </div>

      {(episodesProcessed ?? 0) === 0 && (
        <p style={{ marginTop: "1rem", color: "var(--survivor-text-muted)", fontSize: "0.875rem" }}>
          Week 1 results pending. Once episode results are in, the leaderboard will update.
        </p>
      )}

      <section className="survivor-card" style={{ marginTop: "1.5rem" }}>
        <h2 className="survivor-card__title" style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>
          How scoring works
        </h2>
        <p style={{ color: "var(--survivor-text-muted)", lineHeight: 1.6, margin: 0 }}>
          Pick one castaway to win the season. Each week they survive: +1 point. If they are voted out: -1 point.
          After elimination, you must pick a new remaining player. Picks lock when the episode starts.
        </p>
      </section>
    </>
  );
}
