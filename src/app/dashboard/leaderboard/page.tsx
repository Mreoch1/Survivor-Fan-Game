import { createClient } from "@/lib/supabase/server";
import { PLAYERS } from "@/data/players";

const SEASON = 50;

export default async function LeaderboardPage() {
  const supabase = await createClient();

  const { data: pointsRows } = await supabase
    .from("user_season_points")
    .select("user_id, points, survival_points, tribe_immunity_points, individual_immunity_points, vote_out_points, weeks_survived, eliminations_hit, last_week_delta")
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
      ? await supabase.from("profiles").select("id, display_name, email, deactivated_at").in("id", Array.from(userIds))
      : { data: [] };

  const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);
  const pointsMap = new Map(pointsRows?.map((r) => [r.user_id, r]) ?? []);
  const pickMap = new Map(picks?.map((p) => [p.user_id, p]) ?? []);

  const activeUserIds = Array.from(userIds).filter((uid) => !profileMap.get(uid)?.deactivated_at);

  const rows = activeUserIds.map((userId) => {
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
      survivalPoints: pts?.survival_points ?? 0,
      tribeImmunityPoints: pts?.tribe_immunity_points ?? 0,
      individualImmunityPoints: pts?.individual_immunity_points ?? 0,
      voteOutPoints: pts?.vote_out_points ?? 0,
      points: pts?.points ?? 0,
      pointsFormula: `${pts?.survival_points ?? 0} + ${pts?.tribe_immunity_points ?? 0} + ${pts?.vote_out_points ?? 0} + ${pts?.individual_immunity_points ?? 0}`,
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
          How totals are calculated
        </h2>
        <p className="survivor-leaderboard__explain-line">
          <strong>Total points = Survival + Tribe immunity + Vote-out + Individual immunity</strong>
        </p>
        <ul style={{ color: "var(--survivor-text-muted)", lineHeight: 1.7, margin: "0.5rem 0 0", paddingLeft: "1.25rem" }}>
          <li><strong>Survival:</strong> +1 each week your winner pick survives, -1 if that pick is eliminated.</li>
          <li><strong>Tribe immunity:</strong> +1 for each correct tribe immunity pick (pre-merge weeks).</li>
          <li><strong>Vote-out:</strong> +2 for each correct vote-out pick.</li>
          <li><strong>Individual immunity:</strong> +1 for each correct individual immunity pick (post-merge weeks).</li>
          <li><strong>Repicks</strong> shows how many times your winner pick was eliminated.</li>
        </ul>
      </section>

      <div className="survivor-card survivor-leaderboard">
        <div className="survivor-leaderboard--desktop survivor-table-scroll">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--survivor-border)" }}>
                <th style={{ textAlign: "left", padding: "0.75rem" }}>Rank</th>
                <th style={{ textAlign: "left", padding: "0.75rem" }}>Player</th>
                <th style={{ textAlign: "left", padding: "0.75rem" }}>Current pick</th>
                <th style={{ textAlign: "left", padding: "0.75rem" }}>Status</th>
                <th style={{ textAlign: "right", padding: "0.75rem" }}>Last week</th>
                <th style={{ textAlign: "right", padding: "0.75rem" }}>Repicks</th>
                <th style={{ textAlign: "right", padding: "0.75rem" }} title="Winner pick">
                  Survival (+/-1)
                </th>
                <th style={{ textAlign: "right", padding: "0.75rem" }} title="Tribe immunity (pre-merge)">
                  Tribe (+1)
                </th>
                <th style={{ textAlign: "right", padding: "0.75rem" }} title="Correct vote-out pick = +2">
                  Vote-out (+2)
                </th>
                <th style={{ textAlign: "right", padding: "0.75rem" }} title="Individual immunity (post-merge)">
                  Individual (+1)
                </th>
                <th style={{ textAlign: "right", padding: "0.75rem" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.userId} style={{ borderBottom: "1px solid var(--survivor-border)" }}>
                  <td style={{ padding: "0.75rem" }}>{i + 1}</td>
                  <td style={{ padding: "0.75rem", fontWeight: 600 }}>{row.name}</td>
                  <td style={{ padding: "0.75rem", color: "var(--survivor-text-muted)" }}>{row.currentPick}</td>
                  <td style={{ padding: "0.75rem" }}>
                    <span
                      className={
                        row.status === "SAFE"
                          ? "survivor-leaderboard__status survivor-leaderboard__status--safe"
                          : "survivor-leaderboard__status survivor-leaderboard__status--out"
                      }
                    >
                      {row.status === "SAFE" ? "SAFE" : "OUT, REPICK REQUIRED"}
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem", textAlign: "right", color: "var(--survivor-text-muted)", fontSize: "0.875rem" }}>
                    {row.lastWeekDelta != null
                      ? row.lastWeekDelta >= 0
                        ? `+${row.lastWeekDelta}`
                        : row.lastWeekDelta
                      : "—"}
                  </td>
                  <td style={{ padding: "0.75rem", textAlign: "right" }}>{row.eliminationsHit}</td>
                  <td style={{ padding: "0.75rem", textAlign: "right", color: "var(--survivor-text-muted)", fontSize: "0.875rem" }}>
                    {row.survivalPoints}
                  </td>
                  <td style={{ padding: "0.75rem", textAlign: "right", color: "var(--survivor-text-muted)", fontSize: "0.875rem" }}>
                    {row.tribeImmunityPoints}
                  </td>
                  <td style={{ padding: "0.75rem", textAlign: "right", color: "var(--survivor-text-muted)", fontSize: "0.875rem" }}>
                    {row.voteOutPoints}
                  </td>
                  <td style={{ padding: "0.75rem", textAlign: "right", color: "var(--survivor-text-muted)", fontSize: "0.875rem" }}>
                    {row.individualImmunityPoints}
                  </td>
                  <td style={{ padding: "0.75rem", textAlign: "right", color: "var(--survivor-accent)", fontWeight: 700 }}>
                    {row.points}
                    <div className="survivor-leaderboard__formula" aria-label="Points formula">
                      {row.pointsFormula}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="survivor-leaderboard--mobile survivor-leaderboard__card-list" aria-label="Leaderboard by player">
          {rows.map((row, i) => (
            <li key={row.userId} className="survivor-leaderboard__card">
              <div className="survivor-leaderboard__card-head">
                <div>
                  <span className="survivor-leaderboard__card-rank">#{i + 1}</span>
                  <p className="survivor-leaderboard__card-name">{row.name}</p>
                </div>
                <div className="survivor-leaderboard__card-total-block">
                  <span className="survivor-leaderboard__card-total-label">Total</span>
                  <span className="survivor-leaderboard__card-total">{row.points}</span>
                </div>
              </div>
              <span
                className={
                  row.status === "SAFE"
                    ? "survivor-leaderboard__status survivor-leaderboard__status--safe"
                    : "survivor-leaderboard__status survivor-leaderboard__status--out"
                }
              >
                {row.status === "SAFE" ? "SAFE" : "OUT, REPICK REQUIRED"}
              </span>
              <p className="survivor-leaderboard__card-pick">
                <span className="survivor-leaderboard__card-dt">Current pick</span> {row.currentPick}
              </p>
              <dl className="survivor-leaderboard__metrics">
                <div className="survivor-leaderboard__metric">
                  <dt>Last week</dt>
                  <dd>
                    {row.lastWeekDelta != null
                      ? row.lastWeekDelta >= 0
                        ? `+${row.lastWeekDelta}`
                        : row.lastWeekDelta
                      : "—"}
                  </dd>
                </div>
                <div className="survivor-leaderboard__metric">
                  <dt>Repicks</dt>
                  <dd>{row.eliminationsHit}</dd>
                </div>
                <div className="survivor-leaderboard__metric">
                  <dt>Survival (+/-1)</dt>
                  <dd>{row.survivalPoints}</dd>
                </div>
                <div className="survivor-leaderboard__metric">
                  <dt>Tribe (+1)</dt>
                  <dd>{row.tribeImmunityPoints}</dd>
                </div>
                <div className="survivor-leaderboard__metric">
                  <dt>Vote-out (+2)</dt>
                  <dd>{row.voteOutPoints}</dd>
                </div>
                <div className="survivor-leaderboard__metric">
                  <dt>Individual (+1)</dt>
                  <dd>{row.individualImmunityPoints}</dd>
                </div>
              </dl>
              <p className="survivor-leaderboard__mobile-formula">
                Total formula: {row.survivalPoints} + {row.tribeImmunityPoints} + {row.voteOutPoints} + {row.individualImmunityPoints}
              </p>
            </li>
          ))}
        </ul>

        {rows.length === 0 && (
          <p className="survivor-leaderboard__empty">No points yet. Make your winner pick to start earning.</p>
        )}
      </div>

      {(episodesProcessed ?? 0) === 0 && (
        <p style={{ marginTop: "1rem", color: "var(--survivor-text-muted)", fontSize: "0.875rem" }}>
          Week 1 results pending. Once episode results are in, the leaderboard will update.
        </p>
      )}

    </>
  );
}
