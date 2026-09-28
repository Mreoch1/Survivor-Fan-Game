import { buildPointBreakdown, type PointRow, type RecapPick } from "./recap-email";
import { playerLabel } from "./player-label";
import { scoreSeasonPick } from "./scoring";

export type SeasonProfile = {
  id: string;
  display_name: string;
  team_name: string;
  avatar_key: string;
  league_joined_at: string;
  individual_game_pick: string | null;
  endgame_pick: string | null;
  endgame_pick_switched: boolean;
};
export type SeasonEpisode = {
  id: number;
  title: string;
  phase: "tribe" | "individual";
  lock_at: string;
  reveal_at: string;
  bonus_question: string;
  individual_game_started: boolean;
  results_published: boolean;
};
export type SeasonResult = {
  episode_id: number;
  departures: unknown;
  immunity_void: boolean;
  finale_winner: string | null;
  finalists: unknown;
};
export type SeasonPick = RecapPick & { user_id: string; episode_id: number };

type PublicPointRow = { label: string; points: number; outcome: string };
type PublicEpisodeScore = {
  episodeId: number;
  title: string;
  points: number;
  totalPoints: number;
  roundRank: number;
  overallRank: number;
  movement: number | null;
  rows: PublicPointRow[];
};

function pointOutcome(row: PointRow, pick: SeasonPick | null, immunityVoid: boolean) {
  switch (row.label) {
    case "Weekly Favorite Pick":
      return !pick?.favorite_id ? "No pick on file" : row.points > 0 ? "Not voted out" : "Voted out";
    case "Immunity Pick":
      return immunityVoid ? "Void · existing streak preserved" : !pick?.immunity_pick ? "No pick on file" : row.points > 0 ? "Correct prediction" : "Incorrect prediction";
    case "Vote-Out Pick":
      return !pick?.boot_pick ? "No pick on file" : row.points > 0 ? "Correct prediction" : "Incorrect prediction";
    case "Play Your Advantage":
      return !pick?.bonus_pick ? "Skipped · no points risked" : row.points > 0 ? "Correct answer" : row.points < 0 ? "Incorrect answer" : "No points awarded";
    case "Underdog Bonus":
      return "Fewer than 20% chose this favorite, who stayed in the game";
    case "Immunity Streak":
      return "Three consecutive correct immunity picks";
    case "Shot in the Dark":
      return row.points > 0 ? "Extra reward for a correct prediction" : "No extra points earned";
    case "Opening Outlast Pick":
      return row.selection === "No pick on file" ? "No pick on file" : row.points > 0 ? "Reached the individual game" : "Did not reach the individual game";
    case "Final Torch Pick":
      if (row.selection === "No pick on file") return "No pick on file";
      if (row.points === 10 || row.points === 5) return row.points === 5 ? "Winner · switched pick earns half points" : "Winner award";
      if (row.points === 3 || row.points === 1.5) return row.points === 1.5 ? "Final three · switched pick earns half points" : "Final-three award";
      return "No finale award";
    default:
      return "No points awarded";
  }
}

function rankScores(rows: { id: string; points: number }[]) {
  const sorted = [...rows].sort((a, b) => b.points - a.points || a.id.localeCompare(b.id));
  let rank = 0;
  let previous: number | null = null;
  return sorted.map((row, index) => {
    if (row.points !== previous) rank = index + 1;
    previous = row.points;
    return { ...row, rank };
  });
}

export function buildSeasonDashboard({ viewerId, profiles, episodes, picks, results, castawayName, now = new Date() }: {
  viewerId: string;
  profiles: SeasonProfile[];
  episodes: SeasonEpisode[];
  picks: SeasonPick[];
  results: SeasonResult[];
  castawayName: (id: string | null | undefined) => string | null;
  now?: Date;
}) {
  const viewer = profiles.find(profile => profile.id === viewerId);
  if (!viewer) throw new Error("League membership required");
  // Both gates are deliberate: never derive a score, phase change, or highlight from hidden results.
  const published = episodes.filter(episode => episode.results_published &&
    new Date(episode.reveal_at).getTime() <= now.getTime()).sort((a, b) => a.id - b.id);
  const resultByEpisode = new Map(results.map(result => [result.episode_id, result]));
  const pickByPlayerEpisode = new Map(picks.map(pick => [`${pick.user_id}:${pick.episode_id}`, pick]));
  const individualEpisode = published.find(episode => episode.individual_game_started);
  const finaleEpisode = [...published].reverse().find(episode => resultByEpisode.get(episode.id)?.finale_winner);
  const departedBeforeIndividual = new Set<string>();
  for (const episode of published) {
    if (!individualEpisode || episode.id >= individualEpisode.id) continue;
    const departures = resultByEpisode.get(episode.id)?.departures;
    if (!Array.isArray(departures)) continue;
    for (const departure of departures) {
      if (departure && typeof departure.castawayId === "string") departedBeforeIndividual.add(departure.castawayId);
    }
  }
  const totals = new Map(profiles.map(profile => [profile.id, 0]));
  let previousRanks = new Map<string, number>();
  const history = [];
  const memberHistory = new Map(profiles.map(profile => [profile.id, [] as PublicEpisodeScore[]]));
  let spotlight: {
    episodeId: number; title: string; winners: string[]; winningPoints: number;
    climbers: string[]; placesClimbed: number; voteOutReaders: string[];
  } | null = null;
  const name = (id: string) => {
    const profile = profiles.find(row => row.id === id)!;
    return playerLabel(profile.team_name, profile.display_name);
  };

  for (const episode of published) {
    const result = resultByEpisode.get(episode.id);
    if (!result) throw new Error("A published episode is missing its results");
    const eligible = profiles.filter(profile => new Date(profile.league_joined_at) <= new Date(episode.lock_at));
    const rounds = eligible.map(profile => {
      const pick = pickByPlayerEpisode.get(`${profile.id}:${episode.id}`) || null;
      const original = profile.individual_game_pick || "";
      const reached = Boolean(individualEpisode && original && !departedBeforeIndividual.has(original));
      const endgame = profile.endgame_pick || (reached ? original : "");
      const season = scoreSeasonPick({
        individualGamePick: original, endgamePick: endgame,
        endgamePickSwitched: profile.endgame_pick_switched,
        departedBeforeIndividual, individualGameStarted: episode.id === individualEpisode?.id,
        finaleWinner: episode.id === finaleEpisode?.id ? result.finale_winner || "" : "",
        finalists: Array.isArray(result.finalists) ? result.finalists.map(String) : [],
      });
      const breakdown = buildPointBreakdown({
        pick, phase: episode.phase, castawayName,
        individualGameStarted: episode.id === individualEpisode?.id,
        individualGamePick: original, individualGamePoints: season.individualGamePoints,
        finale: episode.id === finaleEpisode?.id, endgamePick: endgame, endgamePoints: season.endgamePoints,
      });
      totals.set(profile.id, (totals.get(profile.id) || 0) + breakdown.roundPoints);
      return { id: profile.id, points: breakdown.roundPoints, hasPick: Boolean(pick), ...breakdown,
        rows: breakdown.rows.map(row => ({ ...row, outcome: pointOutcome(row, pick, result.immunity_void) })),
      };
    });
    const roundRanks = rankScores(rounds);
    const overallRanks = rankScores(eligible.map(profile => ({ id: profile.id, points: totals.get(profile.id) || 0 })));
    for (const round of rounds) {
      const overall = overallRanks.find(row => row.id === round.id)!;
      // Explicit allowlist: never serialize another member's pick values, even inside collapsed UI.
      memberHistory.get(round.id)!.push({
        episodeId: episode.id, title: episode.title, points: round.points,
        totalPoints: overall.points, roundRank: roundRanks.find(row => row.id === round.id)!.rank,
        overallRank: overall.rank,
        movement: previousRanks.has(round.id) ? previousRanks.get(round.id)! - overall.rank : null,
        rows: round.rows.map(row => ({ label: row.label, points: row.points, outcome: row.outcome })),
      });
    }
    const myRound = rounds.find(round => round.id === viewerId);
    const myOverall = overallRanks.find(row => row.id === viewerId);
    if (myRound && myOverall) {
      history.push({
        episodeId: episode.id, title: episode.title, revealAt: episode.reveal_at,
        bonusQuestion: episode.bonus_question, immunityVoid: result.immunity_void,
        points: myRound.points,
        rows: myRound.rows, carriedFromEpisodeId: myRound.carriedFromEpisodeId,
        hasPick: myRound.hasPick, roundRank: roundRanks.find(row => row.id === viewerId)!.rank,
        overallRank: myOverall.rank, totalPoints: myOverall.points,
        movement: previousRanks.has(viewerId) ? previousRanks.get(viewerId)! - myOverall.rank : null,
      });
    }
    const climbs = overallRanks.map(row => ({ id: row.id, climb: previousRanks.has(row.id) ? previousRanks.get(row.id)! - row.rank : 0 }));
    const placesClimbed = Math.max(0, ...climbs.map(row => row.climb));
    const winningPoints = roundRanks[0]?.points || 0;
    spotlight = {
      episodeId: episode.id, title: episode.title, winningPoints,
      winners: winningPoints > 0 ? roundRanks.filter(row => row.rank === 1).map(row => name(row.id)) : [],
      placesClimbed, climbers: placesClimbed > 0 ? climbs.filter(row => row.climb === placesClimbed).map(row => name(row.id)) : [],
      voteOutReaders: eligible.filter(profile => (pickByPlayerEpisode.get(`${profile.id}:${episode.id}`)?.boot_point || 0) > 0).map(profile => name(profile.id)),
    };
    previousRanks = new Map(overallRanks.map(row => [row.id, row.rank]));
  }
  const publicBoard = (scores: Map<string, number>) => rankScores(profiles.map(profile => ({ id: profile.id, points: scores.get(profile.id) || 0 })))
    .map(row => {
      const episodes = [...memberHistory.get(row.id)!].reverse();
      const latest = episodes[0];
      return { id: row.id, name: name(row.id), points: row.points, rank: row.rank,
        avatarKey: profiles.find(profile => profile.id === row.id)!.avatar_key, isYou: row.id === viewerId,
        latestPoints: latest?.points ?? null, latestEpisodeId: latest?.episodeId ?? null,
        movement: latest?.movement ?? null, episodes };
    });
  const overall = publicBoard(totals);
  return {
    playerName: playerLabel(viewer.team_name, viewer.display_name),
    totalPoints: totals.get(viewerId) || 0,
    overallRank: published.length ? overall.find(row => row.isYou)!.rank : null,
    history: history.reverse(), overall, spotlight,
    latestPublishedEpisodeId: published.at(-1)?.id ?? null,
  };
}

export type SeasonDashboard = ReturnType<typeof buildSeasonDashboard>;
