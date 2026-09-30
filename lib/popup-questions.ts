export type PopupAnswer = "Yes" | "No" | "Skip";
export type PopupQuestion = {
  id: string;
  question: string;
  details: string;
  credit_name: string;
  opens_at: string;
  closes_at: string;
  points: number;
  status: "open" | "resolved" | "void";
  correct_answer: "Yes" | "No" | null;
  resolution_episode_id: number | null;
  reveal_at: string | null;
  created_at?: string;
  created_by?: string;
  resolved_at?: string | null;
  resolved_by?: string | null;
};
export type PopupVote = { question_id: string; user_id: string; answer: PopupAnswer; voted_at: string };

export function isPopupRevealed(question: PopupQuestion, now: Date = new Date()) {
  return (question.status === "resolved" || question.status === "void") &&
    question.resolution_episode_id !== null && question.reveal_at !== null &&
    new Date(question.closes_at) <= now && new Date(question.reveal_at) <= now;
}

export function popupPointsForVote(question: PopupQuestion, vote?: PopupVote, now: Date = new Date()) {
  return isPopupRevealed(question, now) && question.status === "resolved" &&
    (question.correct_answer === "Yes" || question.correct_answer === "No") &&
    vote?.question_id === question.id && vote.answer === question.correct_answer ? 3 : 0;
}

export function publicPopupQuestion(question: PopupQuestion, vote: PopupVote | undefined, episodeRevealed: boolean, now: Date) {
  const revealed = episodeRevealed && isPopupRevealed(question, now);
  const status = revealed ? question.status : new Date(question.closes_at) <= now ? "closed" :
    new Date(question.opens_at) > now ? "pending" : "open";
  return {
    id: question.id, question: question.question, details: question.details, creditName: question.credit_name,
    opensAt: question.opens_at, closesAt: question.closes_at, points: 3,
    status, vote: vote ? { answer: vote.answer, votedAt: vote.voted_at } : null,
    correctAnswer: revealed && question.status === "resolved" ? question.correct_answer : null,
    earnedPoints: revealed ? popupPointsForVote(question, vote, now) : 0,
    revealAt: revealed ? question.reveal_at : null,
  };
}

export const isPopupAnswer = (value: unknown): value is PopupAnswer => value === "Yes" || value === "No" || value === "Skip";
export const isQuestionId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function parsePopupDraft(body: Record<string, unknown>, now: Date) {
  if (!isQuestionId(body.id)) return null;
  if (typeof body.question !== "string" || typeof body.details !== "string" || typeof body.creditName !== "string" ||
    typeof body.opensAt !== "string" || typeof body.closesAt !== "string") return null;
  const question = body.question.trim(), details = body.details.trim(), creditName = body.creditName.trim();
  const opensAt = new Date(body.opensAt), closesAt = new Date(body.closesAt);
  if (!question || question.length > 400 || !details || details.length > 2000 || creditName.length > 100 ||
    !Number.isFinite(opensAt.getTime()) || !Number.isFinite(closesAt.getTime()) || opensAt >= closesAt || closesAt <= now) return null;
  return { id: body.id, question, details, credit_name: creditName, opens_at: opensAt.toISOString(), closes_at: closesAt.toISOString(), points: 3 };
}
