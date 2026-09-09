import { buildPointBreakdown, type RecapPick } from "./recap-email";
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

export function weeklyPoints(pick: RecapPick | null | undefined) {
  return pick ? pick.favorite_point + pick.immunity_point + pick.boot_point + pick.bonus_point +
    pick.underdog_point + pick.streak_point + pick.double_point : 0;
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
  const postMergeTotals = new Map(profiles.map(profile => [profile.id, 0]));
  let previousRanks = new Map<string, number>();
  const history = [];
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
      const weekly = weeklyPoints(pick);
      totals.set(profile.id, (totals.get(profile.id) || 0) + breakdown.roundPoints);
      if (individualEpisode && episode.id > individualEpisode.id) {
        postMergeTotals.set(profile.id, (postMergeTotals.get(profile.id) || 0) + weekly);
      }
      return { id: profile.id, points: breakdown.roundPoints, weeklyPoints: weekly, hasPick: Boolean(pick), ...breakdown };
    });
    const roundRanks = rankScores(rounds);
    const overallRanks = rankScores(eligible.map(profile => ({ id: profile.id, points: totals.get(profile.id) || 0 })));
    const myRound = rounds.find(round => round.id === viewerId);
    const myOverall = overallRanks.find(row => row.id === viewerId);
    if (myRound && myOverall) {
      history.push({
        episodeId: episode.id, title: episode.title, revealAt: episode.reveal_at,
        bonusQuestion: episode.bonus_question, immunityVoid: result.immunity_void,
        points: myRound.points, weeklyPoints: myRound.weeklyPoints,
        rows: myRound.rows, carriedFromEpisodeId: myRound.carriedFromEpisodeId,
        hasPick: myRound.hasPick, roundRank: roundRanks.find(row => row.id === viewerId)!.rank,
        overallRank: myOverall.rank, totalPoints: myOverall.points,
        movement: previousRanks.has(viewerId) ? previousRanks.get(viewerId)! - myOverall.rank : null,
        countsForPostMerge: Boolean(individualEpisode && episode.id > individualEpisode.id),
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
    .map(row => ({ name: name(row.id), points: row.points, rank: row.rank,
      avatarKey: profiles.find(profile => profile.id === row.id)!.avatar_key, isYou: row.id === viewerId }));
  const overall = publicBoard(totals);
  const postMergeEpisodes = individualEpisode ? published.filter(episode => episode.id > individualEpisode.id).length : 0;
  return {
    playerName: playerLabel(viewer.team_name, viewer.display_name),
    totalPoints: totals.get(viewerId) || 0,
    overallRank: published.length ? overall.find(row => row.isYou)!.rank : null,
    history: history.reverse(), overall, spotlight,
    postMerge: {
      announcementEpisodeId: individualEpisode?.id || null, episodesScored: postMergeEpisodes,
      standings: postMergeEpisodes ? publicBoard(postMergeTotals) : [],
    },
  };
}

export type SeasonDashboard = ReturnType<typeof buildSeasonDashboard>;
