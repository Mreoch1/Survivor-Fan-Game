import { isPopupRevealed, popupPointsForVote, type PopupQuestion, type PopupVote } from "./popup-questions";

export type PopupEpisode = { id: number; reveal_at: string; results_published: boolean };

export function revealedPopupQuestions(questions: PopupQuestion[], episodes: PopupEpisode[], now: Date) {
 const published = new Map(episodes.filter(episode => episode.results_published && new Date(episode.reveal_at) <= now).map(episode => [episode.id, episode]));
 return questions.filter(question => isPopupRevealed(question, now) && question.resolution_episode_id !== null && published.has(question.resolution_episode_id) && (!question.resolved_at || new Date(question.resolved_at) <= now));
}

export function buildPopupScoreLedger(questions: PopupQuestion[], votes: PopupVote[], episodes: PopupEpisode[], now: Date) {
 const episodeById = new Map(episodes.map(episode => [episode.id, episode]));
 const votesByQuestion = new Map<string, Map<string, PopupVote>>();
 for (const vote of votes) {
  if (!votesByQuestion.has(vote.question_id)) votesByQuestion.set(vote.question_id, new Map());
  votesByQuestion.get(vote.question_id)!.set(vote.user_id, vote);
 }
 return revealedPopupQuestions(questions, episodes, now).map(question => {
  const episode = episodeById.get(question.resolution_episode_id!)!;
  const revealAt = new Date(Math.max(new Date(question.reveal_at!).getTime(), new Date(episode.reveal_at).getTime(), new Date(question.resolved_at || question.reveal_at!).getTime())).toISOString();
  const questionVotes = votesByQuestion.get(question.id) || new Map<string, PopupVote>();
  const pointsByUser = new Map([...questionVotes].map(([userId, vote]) => [userId, popupPointsForVote(question, vote, now)]));
  return { question, revealAt, votes: questionVotes, pointsByUser };
 }).sort((a, b) => a.revealAt.localeCompare(b.revealAt) || a.question.id.localeCompare(b.question.id));
}

export type PopupScoreLedger = ReturnType<typeof buildPopupScoreLedger>;

export function popupPointsAt(ledger: PopupScoreLedger, userId: string, asOf: Date) {
 return ledger.reduce((sum, entry) => sum + (new Date(entry.revealAt) <= asOf ? entry.pointsByUser.get(userId) || 0 : 0), 0);
}
