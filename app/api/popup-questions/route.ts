import { popupMember, popupQuestionColumns, popupResponse, validPopupRequest } from "../../../db/popup-questions";
import { publishDueResults } from "../../../db/runtime";
import { readAllRows } from "../../../lib/read-all-rows";
import { isPopupAnswer, isQuestionId, publicPopupQuestion, type PopupQuestion, type PopupVote } from "../../../lib/popup-questions";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const auth = await popupMember();
    if (auth.response) return auth.response;
    const { user, db } = auth, now = new Date();
    await publishDueResults(now);
    const [questions, votes, episodes, upcoming] = await Promise.all([
      readAllRows<PopupQuestion>((from, to) => db.from("popup_questions").select(popupQuestionColumns)
        .lte("opens_at", now.toISOString()).order("created_at").order("id").range(from, to)),
      readAllRows<PopupVote>((from, to) => db.from("popup_votes").select("question_id,user_id,answer,voted_at")
        .eq("user_id", user.userId).order("question_id").range(from, to)),
      readAllRows<{ id: number }>((from, to) => db.from("episodes").select("id").eq("results_published", true)
        .lte("reveal_at", now.toISOString()).order("id").range(from, to)),
      db.from("popup_questions").select("opens_at").eq("status", "open")
        .gt("opens_at", now.toISOString()).order("opens_at").limit(1).maybeSingle(),
    ]);
    if (upcoming.error) throw upcoming.error;
    const published = new Set(episodes.map(episode => episode.id));
    const ownVotes = new Map(votes.map(vote => [vote.question_id, vote]));
    return popupResponse({ questions: questions.map(question => publicPopupQuestion(question, ownVotes.get(question.id),
      question.resolution_episode_id !== null && published.has(question.resolution_episode_id), now)), serverNow: now.toISOString(), nextOpensAt: upcoming.data?.opens_at || null });
  } catch {
    return popupResponse({ error: "Bonus questions could not load. Please try again." }, 503);
  }
}
export async function POST(request: Request) {
  try {
    const auth = await popupMember();
    if (auth.response) return auth.response;
    if (!validPopupRequest(request)) return popupResponse({ error: "Open the league to submit your vote" }, 403);
    const body = await request.json().catch(() => null);
    if (!isQuestionId(body?.questionId) || !isPopupAnswer(body?.answer)) return popupResponse({ error: "Choose Yes, No, or Skip for an available question" }, 400);
    const { data, error } = await auth.db.rpc("submit_popup_vote", {
      p_question_id: body.questionId, p_user_id: auth.user.userId, p_answer: body.answer,
    });
    if (error || !data) throw error || new Error("Missing vote receipt");
    return popupResponse(data, data.ok ? 200 : data.status || 409);
  } catch {
    return popupResponse({ error: "Your vote could not be confirmed. Retry the same answer to check whether it saved." }, 503);
  }
}
