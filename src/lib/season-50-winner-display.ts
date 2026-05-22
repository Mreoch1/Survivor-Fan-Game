import { createClient } from "@/lib/supabase/server";
import { PLAYERS } from "@/data/players";
import { getSeason50TotalEpisodes, SEASON_50 } from "@/lib/season-50-countdown";
import { SEASON_50_FINALE } from "@/lib/season-50-finale";

export type FinalePodiumEntry = {
  place: 1 | 2 | 3;
  label: string;
  playerId: string;
  name: string;
  imageUrl: string | null;
};

export type FanGameStanding = {
  rank: 1 | 2 | 3;
  name: string;
  points: number;
};

export type SeasonWinnerDisplay = {
  podium: FinalePodiumEntry[];
  fanStandings: FanGameStanding[];
};

export async function isSeason50Complete(): Promise<boolean> {
  const supabase = await createClient();
  const total = getSeason50TotalEpisodes();
  const { count, error } = await supabase
    .from("episodes")
    .select("id", { count: "exact", head: true })
    .eq("season", SEASON_50)
    .not("voted_out_player_id", "is", null);

  if (error) return false;
  return (count ?? 0) >= total;
}

function playerPodiumEntry(
  place: 1 | 2 | 3,
  label: string,
  playerId: string
): FinalePodiumEntry | null {
  const player = PLAYERS.find((p) => p.id === playerId);
  if (!player) return null;
  return {
    place,
    label,
    playerId,
    name: player.name,
    imageUrl: player.imageUrl,
  };
}

export async function getSeason50WinnerDisplay(): Promise<SeasonWinnerDisplay | null> {
  if (!(await isSeason50Complete())) return null;

  const podium = [
    playerPodiumEntry(1, "Sole Survivor", SEASON_50_FINALE.winnerPlayerId),
    playerPodiumEntry(2, "2nd place", SEASON_50_FINALE.secondPlacePlayerId),
    playerPodiumEntry(3, "3rd place", SEASON_50_FINALE.thirdPlacePlayerId),
  ].filter((e): e is FinalePodiumEntry => e !== null);

  const supabase = await createClient();
  const { data: pointsRows } = await supabase
    .from("user_season_points")
    .select("user_id, points")
    .eq("season", SEASON_50)
    .order("points", { ascending: false });

  const userIds = (pointsRows ?? []).map((r) => r.user_id);
  const { data: profiles } =
    userIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, display_name, email, deactivated_at")
          .in("id", userIds)
      : { data: [] };

  const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);
  const activeRows = (pointsRows ?? []).filter((r) => !profileMap.get(r.user_id)?.deactivated_at);

  const fanStandings: FanGameStanding[] = activeRows.slice(0, 3).map((row, i) => {
    const profile = profileMap.get(row.user_id);
    return {
      rank: (i + 1) as 1 | 2 | 3,
      name: profile?.display_name || profile?.email || "Player",
      points: row.points ?? 0,
    };
  });

  return { podium, fanStandings };
}
