import assert from "node:assert/strict";
import test from "node:test";
import { isPopupRevealed, isPopupAnswer, isQuestionId, parsePopupDraft, popupPointsForVote, publicPopupQuestion, type PopupQuestion, type PopupVote } from "../lib/popup-questions";
const now = new Date("2026-10-12T10:30:00Z");
const question: PopupQuestion = { id: "11111111-1111-4111-8111-111111111111", question: "During Episode 3, will this happen?", details: "Only official outcomes count.", credit_name: "Prost Tosties", points: 3, opens_at: "2026-09-30T12:00:00Z", closes_at: "2026-10-07T23:00:00Z", status: "resolved", correct_answer: "Yes", resolution_episode_id: 3, reveal_at: now.toISOString(), resolved_at: "2026-10-08T14:00:00Z" };
const vote: PopupVote = { question_id: question.id, user_id: "player", answer: "Yes", voted_at: "2026-10-01T12:00:00Z" };
test("popup award is exactly three only for a matching answer after the reveal", () => {
  assert.equal(popupPointsForVote(question, vote, now), 3);
  for (const answer of ["No", "Skip"] as const) assert.equal(popupPointsForVote(question, { ...vote, answer }, now), 0);
  assert.equal(popupPointsForVote(question, undefined, now), 0);
  assert.equal(popupPointsForVote(question, { ...vote, question_id: "other" }, now), 0);
  assert.equal(popupPointsForVote(question, vote, new Date(now.getTime() - 1)), 0);
  for (const changed of [{ status: "void" as const }, { status: "open" as const }, { correct_answer: null }, { resolution_episode_id: null }, { reveal_at: null }]) {
    assert.equal(popupPointsForVote({ ...question, ...changed }, vote, now), 0);
  }
  assert.equal(isPopupRevealed({ ...question, closes_at: "2027-01-01T00:00:00Z" }, now), false);
});
test("public projection hides pending outcome and only includes the viewer receipt", () => {
  const hidden = publicPopupQuestion(question, vote, false, now);
  assert.equal(hidden.status, "closed");
  assert.equal(hidden.correctAnswer, null);
  assert.equal(hidden.revealAt, null);
  assert.equal(hidden.earnedPoints, 0);
  assert.deepEqual(hidden.vote, { answer: "Yes", votedAt: vote.voted_at });
  assert.equal("user_id" in hidden, false);
  assert.equal(publicPopupQuestion(question, vote, true, now).earnedPoints, 3);
  assert.equal(publicPopupQuestion({ ...question, status: "void", correct_answer: null }, vote, true, now).status, "void");
  const early = publicPopupQuestion(question, vote, true, new Date(now.getTime() - 1));
  assert.equal(early.correctAnswer, null);
  assert.equal(early.revealAt, null);
});
test("draft validation rejects missing rules, invalid windows and spoofed scoring", () => {
  const body = { id: question.id, question: question.question, details: question.details, creditName: question.credit_name, opensAt: "2026-10-13T12:00:00Z", closesAt: "2026-10-14T23:00:00Z", points: 99 };
  assert.equal(parsePopupDraft(body, now)?.points, 3);
  for (const changed of [{ details: " " }, { question: "a".repeat(401) }, { creditName: "a".repeat(101) }, { id: "bad" }, { opensAt: "invalid" }, { closesAt: body.opensAt }, { closesAt: "2026-10-01T00:00:00Z" }]) assert.equal(parsePopupDraft({ ...body, ...changed }, now), null);
  assert.equal(isPopupAnswer("Yes"), true);
  assert.equal(isPopupAnswer("yes"), false);
  assert.equal(isQuestionId(question.id), true);
  assert.equal(isQuestionId("not-a-question"), false);
});
