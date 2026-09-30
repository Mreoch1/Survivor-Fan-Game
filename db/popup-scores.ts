import { createAdminClient } from "../lib/supabase/admin";
import { readAllRows } from "../lib/read-all-rows";
import { revealedPopupQuestions, type PopupEpisode } from "../lib/popup-score-ledger";
import type { PopupQuestion, PopupVote } from "../lib/popup-questions";

// This read-only loader is shared by page totals, recap totals, and cached profile totals.
export async function loadPopupScores(episodes: PopupEpisode[], now = new Date(), db = createAdminClient()) {
 const questions = await readAllRows<PopupQuestion>((from, to) => db.from("popup_questions")
  .select("id,question,details,credit_name,opens_at,closes_at,points,status,correct_answer,resolution_episode_id,reveal_at,resolved_at,created_at")
  .in("status", ["resolved", "void"]).lte("reveal_at", now.toISOString()).order("created_at").order("id").range(from, to));
 const popupQuestions = revealedPopupQuestions(questions, episodes, now);
 const ids = popupQuestions.map(question => question.id);
 const popupVotes = ids.length ? await readAllRows<PopupVote>((from, to) => db.from("popup_votes")
  .select("question_id,user_id,answer,voted_at").in("question_id", ids).order("question_id").order("user_id").range(from, to)) : [];
 return { popupQuestions, popupVotes };
}
