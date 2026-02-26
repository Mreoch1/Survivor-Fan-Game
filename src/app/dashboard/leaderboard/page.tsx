import { createClient } from "@/lib/supabase/server";
import { PLAYERS } from "@/data/players";

const POINTS = {
  voteOutCorrect: 15,
  winnerCorrect: 100,
  tribeHasWinner: 25,
  tribeFinalist: 10,
} as const;

export default async function LeaderboardPage() {
  const supabase = await createClient();

  const { data: episodes } = await supabase
    .from("episodes")
    .select("id, episode_number, voted_out_player_id")
    .eq("season", 50)
    .not("voted_out_player_id", "is", null);

  const { data: voteOutPicks } = await supabase
    .from("vote_out_picks")
    .select("user_id, episode_id, player_id");

  const { data: winnerPicks } = await supabase
    .from("winner_picks")
    .select("user_id, player_id")
    .eq("season", 50);

  const { data: tribePicks } = await supabase
    .from("tribe_picks")
    .select("user_id, tribe_id")
    .eq("season", 50);

  const episodeMap = new Map(episodes?.map((e) => [e.id, e]) ?? []);
  const correctVoteOutsByUser = new Map<string, number>();

  voteOutPicks?.forEach((pick) => {
    const ep = episodeMap.get(pick.episode_id);
    if (!ep?.voted_out_player_id) return;
    const correct = pick.player_id === ep.voted_out_player_id;
    if (correct) {
      correctVoteOutsByUser.set(
        pick.user_id,
        (correctVoteOutsByUser.get(pick.user_id) ?? 0) + 1
      );
    }
  });

  const userIds = new Set<string>();
  winnerPicks?.forEach((p) => userIds.add(p.user_id));
  tribePicks?.forEach((p) => userIds.add(p.user_id));
  voteOutPicks?.forEach((p) => userIds.add(p.user_id));

  const ids = Array.from(userIds);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, display_name, email").in("id", ids)
    : { data: [] };

  const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);

  const seasonWinnerId: string | null = null;
  const finalistIds: string[] = [];

  const rows: { userId: string; name: string; voteOutPts: number; winnerPts: number; tribePts: number }[] = [];

  userIds.forEach((userId) => {
    const profile = profileMap.get(userId);
    const name = profile?.display_name || profile?.email || "Player";
    const voteOutPts = (correctVoteOutsByUser.get(userId) ?? 0) * POINTS.voteOutCorrect;
    const wp = winnerPicks?.find((p) => p.user_id === userId);
    const winnerPts = seasonWinnerId && wp?.player_id === seasonWinnerId ? POINTS.winnerCorrect : 0;
    const tp = tribePicks?.find((p) => p.user_id === userId);
    let tribePts = 0;
    if (tp && seasonWinnerId) {
      const winnerPlayer = PLAYERS.find((p) => p.id === seasonWinnerId);
      if (winnerPlayer?.tribeId === tp.tribe_id) tribePts += POINTS.tribeHasWinner;
      finalistIds.forEach((fid) => {
        const fp = PLAYERS.find((p) => p.id === fid);
        if (fp?.tribeId === tp.tribe_id) tribePts += POINTS.tribeFinalist;
      });
    }
    rows.push({ userId, name, voteOutPts, winnerPts, tribePts });
  });

  const withTotal = rows.map((r) => ({
    ...r,
    total: r.voteOutPts + r.winnerPts + r.tribePts,
  }));
  withTotal.sort((a, b) => b.total - a.total);

  return (
    <>
      <h1 className="survivor-card__title" style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
        Leaderboard
      </h1>
      <p style={{ color: "var(--survivor-text-muted)", marginBottom: "1.5rem" }}>
        Points: 15 per correct vote-out, 100 for correct winner, 25 if your tribe has the winner, 10 per tribe finalist. Winner and finalist points are added at season end.
      </p>
      <div className="survivor-card" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--survivor-border)" }}>
              <th style={{ textAlign: "left", padding: "0.75rem" }}>#</th>
              <th style={{ textAlign: "left", padding: "0.75rem" }}>Player</th>
              <th style={{ textAlign: "right", padding: "0.75rem" }}>Vote-out</th>
              <th style={{ textAlign: "right", padding: "0.75rem" }}>Winner</th>
              <th style={{ textAlign: "right", padding: "0.75rem" }}>Tribe</th>
              <th style={{ textAlign: "right", padding: "0.75rem" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {withTotal.map((row, i) => (
              <tr key={row.userId} style={{ borderBottom: "1px solid var(--survivor-border)" }}>
                <td style={{ padding: "0.75rem" }}>{i + 1}</td>
                <td style={{ padding: "0.75rem", fontWeight: 600 }}>{row.name}</td>
                <td style={{ padding: "0.75rem", textAlign: "right" }}>{row.voteOutPts}</td>
                <td style={{ padding: "0.75rem", textAlign: "right" }}>{row.winnerPts}</td>
                <td style={{ padding: "0.75rem", textAlign: "right" }}>{row.tribePts}</td>
                <td style={{ padding: "0.75rem", textAlign: "right", color: "var(--survivor-accent)", fontWeight: 700 }}>
                  {row.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {withTotal.length === 0 && (
          <p style={{ color: "var(--survivor-text-muted)", padding: "1rem" }}>
            No picks yet. Be the first to make your picks.
          </p>
        )}
      </div>
    </>
  );
}
