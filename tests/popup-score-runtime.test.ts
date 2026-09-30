import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { publishDueResults, refreshPublishedScores } from "../db/runtime";
import type { PopupQuestion } from "../lib/popup-questions";

const revealAt = "2026-09-28T10:30:00Z";
const afterReveal = new Date("2026-09-29T12:30:00Z");
function fixture(t: TestContext) {
 const originalEnv = { ...process.env };
 process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.example.test";
 process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-only";
 t.after(() => { process.env = originalEnv; });
 const questions: PopupQuestion[] = [{ id: "popup", question: "SECRET_REVEALED_QUESTION", details: "Exact episode scope", credit_name: "", opens_at: "2026-09-21T00:00:00Z", closes_at: "2026-09-23T00:00:00Z", points: 3, status: "resolved", correct_answer: "Yes", resolution_episode_id: 1, reveal_at: revealAt, resolved_at: revealAt }];
 const profiles: Record<string, unknown>[] = ["a", "b"].map(id => ({ id, individual_game_pick: "", endgame_pick: "", endgame_pick_switched: false, total_points: 3, preseason_points: 0, individual_game_points: 0, endgame_points: 0, immunity_streak: 1, longest_streak: 1, updated_at: "2026-09-24T10:30:00Z" }));
 const reads: string[] = [], receipts = new Set<string>();
 const votes = [{ question_id: "popup", user_id: "a", answer: "Yes", voted_at: "2026-09-22T00:00:00Z" }, { question_id: "popup", user_id: "b", answer: "No", voted_at: "2026-09-22T00:00:00Z" }];
 const state = { failure: "", commits: 0, writes: 0, onCommit: () => {} };
 t.mock.method(globalThis, "fetch", async (request: string | URL | Request, init?: RequestInit) => {
  const url = new URL(request instanceof Request ? request.url : String(request));
  const table = url.pathname.split("/").at(-1)!;
  const method = init?.method || "GET";
  if (table === state.failure) return Response.json({ message: "Popup fixture unavailable" }, { status: 400 });
  if (table === "apply_published_scores") {
   assert.equal(method, "POST");
   const body = JSON.parse(String(init?.body));
   assert.deepEqual(body.p_episode_ids, [1]);
   assert.deepEqual(body.p_streak_scores, [{ id: 0, streak_point: 0 }, { id: 1, streak_point: 0 }]);
   state.onCommit();
   // The PostgreSQL suite checks these atomicity and stale-snapshot rules against the real RPC.
   if ([...receipts].some(id => !body.p_question_ids.includes(id))) return Response.json(false);
   for (const row of body.p_profile_scores) {
    const profile = profiles.find(profile => profile.id === row.id)!;
    const fields = Object.fromEntries(Object.entries(row).filter(([key]) => !["id", "individual_game_pick", "endgame_pick", "endgame_pick_switched"].includes(key)));
    if (Object.entries(fields).some(([key, value]) => profile[key] !== value)) {
     Object.assign(profile, fields, { updated_at: body.p_scored_at });
     state.writes++;
    }
   }
   for (const id of body.p_question_ids) receipts.add(id);
   state.commits++;
   return Response.json(true);
  }
  assert.equal(method, "GET", "All cached score and receipt writes use the atomic RPC");
  reads.push(table);
  if (table === "episodes") {
   if (url.searchParams.get("results_published") === "eq.false") return Response.json([]);
   assert.equal(url.searchParams.get("results_published"), "eq.true");
   return Response.json([{ id: 1, individual_game_started: false, results_published: true, reveal_at: "2026-09-24T10:30:00Z" }]);
  }
  if (table === "pending_popup_score_publications") {
   assert.equal(url.searchParams.get("limit"), "1");
   const cutoff = new Date(url.searchParams.get("available_at")!.slice(4));
   const due = questions.filter(q => !receipts.has(q.id) && q.resolution_episode_id === 1 && new Date(q.reveal_at!) <= cutoff && new Date(q.resolved_at!) <= cutoff);
   return Response.json(due.slice(0, 1).map(q => ({ question_id: q.id })));
  }
  if (table === "profiles") return Response.json(profiles);
  if (table === "picks") return Response.json(["a", "b"].map((user_id, id) => ({ id, user_id, episode_id: 1, favorite_point: 1, immunity_point: 2, boot_point: 0, bonus_point: 0, underdog_point: 0, streak_point: 0, double_point: 0 })));
  if (table === "episode_results") return Response.json([{ episode_id: 1, departures: [], immunity_void: false, finale_winner: null, finalists: [] }]);
  if (table === "popup_questions") {
   assert.equal(url.searchParams.get("status"), "in.(resolved,void)");
   const cutoff = new Date(url.searchParams.get("reveal_at")!.slice(4));
   return Response.json(questions.filter(q => new Date(q.reveal_at!) <= cutoff));
  }
  if (table === "popup_votes") {
   const ids = url.searchParams.get("question_id")!.slice(4, -1).split(",");
   return Response.json(votes.filter(vote => ids.includes(vote.question_id)));
  }
  throw new Error(`Unexpected query: ${table}`);
 });
 return { profiles, questions, votes, receipts, reads, state };
}

test("one popup publication refreshes once; subsequent reads do not scan score history", async t => {
 const { profiles, questions, votes, receipts, reads, state } = fixture(t);
 await publishDueResults(new Date("2026-09-28T10:29:59Z"));
 assert.equal(state.commits, 0);
 assert.equal(reads.includes("profiles"), false);
 assert.equal(await publishDueResults(new Date(revealAt)), 0, "No new episode was published");
 assert.deepEqual(profiles.map(p => p.total_points), [6, 3]);
 assert.deepEqual([...receipts], ["popup"]);
 assert.equal(state.writes, 1);
 reads.length = 0;
 for (let i = 0; i < 3; i++) await publishDueResults(afterReveal);
 assert.deepEqual(reads, Array.from({ length: 3 }, () => ["episodes", "pending_popup_score_publications"]).flat());
 assert.equal(state.commits, 1, "Historical receipts must not trigger another full computation");
 questions.push({ ...questions[0], id: "later", reveal_at: "2026-10-05T10:30:00Z", resolved_at: "2026-10-05T10:30:00Z" });
 votes.push({ ...votes[0], question_id: "later", user_id: "b" });
 await publishDueResults(new Date("2026-10-05T10:30:00Z"));
 assert.deepEqual(profiles.map(p => p.total_points), [6, 6]);
 assert.equal(state.commits, 2, "A later popup still triggers its own publication");
 const saved = JSON.stringify(profiles);
 await refreshPublishedScores(new Date("2026-10-06T10:30:00Z"));
 assert.equal(JSON.stringify(profiles), saved, "Explicit refresh neither double-awards nor churns timestamps");
});

test("failed atomic publication stays pending and succeeds on retry", async t => {
 const { profiles, receipts, state } = fixture(t);
 state.failure = "apply_published_scores";
 await assert.rejects(publishDueResults(afterReveal));
 assert.deepEqual(profiles.map(p => p.total_points), [3, 3]);
 assert.equal(receipts.size, 0);
 state.failure = "";
 await publishDueResults(afterReveal);
 assert.deepEqual(profiles.map(p => p.total_points), [6, 3]);
 assert.deepEqual([...receipts], ["popup"]);
});

test("query failures never publish receipts or discard existing popup totals", async t => {
 const { profiles, receipts, state } = fixture(t);
 for (const table of ["pending_popup_score_publications", "popup_questions", "popup_votes"]) {
  state.failure = table;
  await assert.rejects(publishDueResults(afterReveal));
  assert.equal(receipts.size, 0);
  assert.deepEqual(profiles.map(p => p.total_points), [3, 3]);
 }
 state.failure = "";
 await publishDueResults(afterReveal);
 state.failure = "popup_votes";
 await assert.rejects(refreshPublishedScores(afterReveal));
 assert.deepEqual(profiles.map(p => p.total_points), [6, 3]);
});

test("receipts cover only the qualified calculation snapshot", async t => {
 const { questions, receipts, state } = fixture(t);
 questions.push({ ...questions[0], id: "unpublished-episode", resolution_episode_id: 2 });
 state.onCommit = () => {
  questions.push({ ...questions[0], id: "resolved-during-commit" });
  state.onCommit = () => {};
 };
 await publishDueResults(afterReveal);
 assert.deepEqual([...receipts], ["popup"], "Unpublished episodes and questions outside the calculation cannot get receipts");
 await publishDueResults(afterReveal);
 assert.deepEqual([...receipts].sort(), ["popup", "resolved-during-commit"]);
});


test("an overlapping newer publication retries with fresh inputs instead of silently skipping", async t => {
 const { questions, votes, profiles, receipts, state, reads } = fixture(t);
 state.onCommit = () => {
  questions.push({ ...questions[0], id: "concurrent" });
  votes.push({ ...votes[0], question_id: "concurrent" });
  receipts.add("concurrent");
  state.onCommit = () => {};
 };
 await publishDueResults(afterReveal);
 assert.equal(reads.filter(table => table === "profiles").length, 2);
 assert.deepEqual(profiles.map(profile => profile.total_points), [9, 3]);
 assert.deepEqual([...receipts].sort(), ["concurrent", "popup"]);
});
