import { popupMember, popupQuestionColumns, popupResponse, validPopupRequest } from "../../../../db/popup-questions";
import { refreshPublishedScores } from "../../../../db/runtime";
import { readAllRows } from "../../../../lib/read-all-rows";
import { isQuestionId, parsePopupDraft, type PopupQuestion } from "../../../../lib/popup-questions";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const auth = await popupMember(true);
    if (auth.response) return auth.response;
    const { db } = auth, now = new Date();
    const [questions, votes, episodes] = await Promise.all([
      readAllRows<PopupQuestion>((from, to) => db.from("popup_questions").select(popupQuestionColumns).order("created_at", { ascending: false }).order("id").range(from, to)),
      readAllRows<{ question_id: string }>((from, to) => db.from("popup_votes").select("question_id").order("question_id").order("user_id").range(from, to)),
      readAllRows<{ id: number; title: string; results_posted: boolean; reveal_at: string }>((from, to) => db.from("episodes").select("id,title,results_posted,reveal_at").order("id").range(from, to)),
    ]);
    const counts = new Map<string, number>();
    for (const vote of votes) counts.set(vote.question_id, (counts.get(vote.question_id) || 0) + 1);
    return popupResponse({ questions: questions.map(question => ({ ...question, votesCount: counts.get(question.id) || 0,
      canResolve: question.status === "open" && new Date(question.closes_at) <= now })),
      episodes: episodes.map(episode => ({ id: episode.id, title: episode.title, resultsPosted: episode.results_posted, revealAt: episode.reveal_at })) });
  } catch {
    return popupResponse({ error: "Bonus question controls could not load. Please try again." }, 503);
  }
}
export async function POST(request: Request) {
  try {
    const auth = await popupMember(true);
    if (auth.response) return auth.response;
    if (!validPopupRequest(request)) return popupResponse({ error: "Open commissioner controls to make this change" }, 403);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return popupResponse({ error: "A question action is required" }, 400);
    if (body.action === "create") {
      // Validate shape first; an identical retry stays successful even after closing.
      const draft = parsePopupDraft(body, new Date(0));
      if (!draft) return popupResponse({ error: "Enter the question, precise rules, credit, and a valid voting window" }, 400);
      const { data: existing, error: readError } = await auth.db.from("popup_questions").select(popupQuestionColumns).eq("id", draft.id).maybeSingle();
      if (readError) throw readError;
      if (!existing && new Date(draft.closes_at) <= new Date()) return popupResponse({ error: "Voting must close in the future" }, 400);
      if (!existing) {
        const { error } = await auth.db.from("popup_questions").upsert({ ...draft, created_by: auth.user.userId }, { onConflict: "id", ignoreDuplicates: true });
        if (error) throw error;
      }
      const { data: saved, error } = await auth.db.from("popup_questions").select(popupQuestionColumns).eq("id", draft.id).single();
      if (error) throw error;
      const same = saved.created_by === auth.user.userId && Object.entries(draft).every(([key, value]) =>
        key === "opens_at" || key === "closes_at" ? new Date(saved[key]).getTime() === new Date(String(value)).getTime() : saved[key as keyof typeof saved] === value);
      if (!same) return popupResponse({ error: "This question ID already belongs to a different published question. Refresh the controls." }, 409);
      return popupResponse({ ok: true, question: saved, alreadyCreated: Boolean(existing) });
    }
    if (body.action === "resolve") {
      if (!isQuestionId(body.questionId) || !["Yes", "No", "Void"].includes(body.answer) || !Number.isInteger(body.episodeId) || body.episodeId < 1) {
        return popupResponse({ error: "Choose the question, official answer, and result episode" }, 400);
      }
      const { data, error } = await auth.db.rpc("resolve_popup_question", {
        p_question_id: body.questionId, p_actor_id: auth.user.userId, p_answer: body.answer, p_episode_id: body.episodeId,
      });
      if (error || !data) throw error || new Error("Missing resolution receipt");
      if (!data.ok) return popupResponse(data, data.status || 409);
      await refreshPublishedScores();
      return popupResponse(data);
    }
    return popupResponse({ error: "Choose create or resolve" }, 400);
  } catch {
    return popupResponse({ error: "This change could not be confirmed. Retry the same action to check whether it saved." }, 503);
  }
}
