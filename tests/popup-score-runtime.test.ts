import assert from "node:assert/strict";
import test from "node:test";
import { publishDueResults, refreshPublishedScores } from "../db/runtime";
import type { PopupQuestion } from "../lib/popup-questions";

test("popup reveals refresh cached totals without a new episode, repeat safely, and fail closed on query errors", async t => {
 const originalEnv = { ...process.env };
 process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.example.test";
 process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-only";
 t.after(() => { process.env = originalEnv; });
 const revealAt = "2026-09-28T10:30:00Z";
 const question: PopupQuestion = { id: "popup", question: "SECRET_REVEALED_QUESTION", details: "Exact episode scope", credit_name: "", opens_at: "2026-09-21T00:00:00Z", closes_at: "2026-09-23T00:00:00Z", points: 3, status: "resolved", correct_answer: "Yes", resolution_episode_id: 1, reveal_at: revealAt };
 const profiles: Record<string, unknown>[] = ["a", "b"].map(id => ({ id, individual_game_pick: "", endgame_pick: "", endgame_pick_switched: false, total_points: 3, preseason_points: 0, individual_game_points: 0, endgame_points: 0, immunity_streak: 1, longest_streak: 1, updated_at: "2026-09-24T10:30:00Z" }));
 const writes: { table: string; body: Record<string, unknown> }[] = [];
 let queryFailure: "popup_questions" | "popup_votes" | null = null;
 t.mock.method(globalThis, "fetch", async (request: string | URL | Request, init?: RequestInit) => {
  const url = new URL(request instanceof Request ? request.url : String(request));
  const table = url.pathname.split("/").at(-1)!;
  const method = init?.method || "GET";
  if (table === queryFailure) return Response.json({ message: "Popup fixture query unavailable" }, { status: 400 });
  if (method === "PATCH") {
   assert.equal(table, "profiles", "A popup refresh cannot change existing episode results or picks");
   const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
   writes.push({ table, body });
   const profile = profiles.find(profile => `eq.${profile.id}` === url.searchParams.get("id"))!;
   Object.assign(profile, body);
   return Response.json(null);
  }
  assert.equal(method, "GET");
  if (table === "episodes") {
   if (url.searchParams.get("results_published") === "eq.false") return Response.json([]);
   assert.equal(url.searchParams.get("results_published"), "eq.true");
   assert.ok(url.searchParams.has("reveal_at"));
   return Response.json([{ id: 1, individual_game_started: false, results_published: true, reveal_at: "2026-09-24T10:30:00Z" }]);
  }
  if (table === "profiles") return Response.json(profiles);
  if (table === "picks") return Response.json(["a", "b"].map((user_id, id) => ({ id, user_id, episode_id: 1, favorite_point: 1, immunity_point: 2, boot_point: 0, bonus_point: 0, underdog_point: 0, streak_point: 0, double_point: 0 })));
  if (table === "episode_results") return Response.json([{ episode_id: 1, departures: [], immunity_void: false, finale_winner: null, finalists: [] }]);
  if (table === "popup_questions") {
   assert.equal(url.searchParams.get("status"), "in.(resolved,void)");
   const cutoff = new Date(url.searchParams.get("reveal_at")!.slice(4));
   const rows = new Date(revealAt) <= cutoff ? [question] : [];
   return Response.json(url.searchParams.get("select") === "id" ? rows.map(row => ({ id: row.id })) : rows);
  }
  if (table === "popup_votes") {
   assert.equal(url.searchParams.get("question_id"), "in.(popup)");
   return Response.json([{ question_id: "popup", user_id: "a", answer: "Yes", voted_at: "2026-09-22T00:00:00Z" }, { question_id: "popup", user_id: "b", answer: "No", voted_at: "2026-09-22T00:00:00Z" }]);
  }
  throw new Error(`Unexpected query: ${table}`);
 });
 assert.equal(await publishDueResults(new Date("2026-09-28T10:29:59Z")), 0);
 assert.equal(writes.length, 0);
 assert.deepEqual(profiles.map(profile => profile.total_points), [3, 3]);
 assert.equal(await publishDueResults(new Date(revealAt)), 0, "No new episode was published");
 assert.deepEqual(profiles.map(profile => profile.total_points), [6, 3]);
 assert.equal(writes.length, 1, "Only the winner's changed cached score is written");
 const saved = JSON.stringify(profiles);
 await publishDueResults(new Date("2026-09-28T12:30:00Z"));
 await refreshPublishedScores(new Date("2026-09-29T12:30:00Z"));
 assert.equal(writes.length, 1, "Repeated refreshes never add the award twice or churn timestamps");
 assert.equal(JSON.stringify(profiles), saved);
 for (const table of ["popup_questions", "popup_votes"] as const) {
  queryFailure = table;
  await assert.rejects(refreshPublishedScores(new Date("2026-09-29T12:30:00Z")), error => (error as { message: string }).message.includes("Popup fixture query unavailable"));
  assert.equal(JSON.stringify(profiles), saved, "Query failure must not overwrite totals with missing popup points");
  assert.equal(writes.length, 1);
 }
});
