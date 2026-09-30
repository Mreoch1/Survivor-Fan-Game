import assert from "node:assert/strict";
import test from "node:test";
import { revealAtForAirTime } from "../db/runtime";
import { scheduleEpisode } from "../db/schedule";

test("Wednesday episodes reveal the following Monday at 6:30 AM Detroit time", () => {
 assert.equal(revealAtForAirTime(new Date("2026-10-01T00:00:00Z")), "2026-10-05T10:30:00.000Z");
 assert.equal(revealAtForAirTime(new Date("2026-12-03T01:00:00Z")), "2026-12-07T11:30:00.000Z");
});

test("reveal times follow Detroit daylight saving changes rather than the air date offset", () => {
 assert.equal(revealAtForAirTime(new Date("2026-03-05T01:00:00Z")), "2026-03-09T10:30:00.000Z");
 assert.equal(revealAtForAirTime(new Date("2026-10-29T00:00:00Z")), "2026-11-02T11:30:00.000Z");
});

test("following Monday crosses year boundaries", () => {
 assert.equal(revealAtForAirTime(new Date("2026-12-31T01:00:00Z")), "2027-01-04T11:30:00.000Z");
});

test("Monday air dates always wait a week, while late Sunday uses the next morning", () => {
 assert.equal(revealAtForAirTime(new Date("2026-09-28T04:01:00Z")), "2026-10-05T10:30:00.000Z");
 assert.equal(revealAtForAirTime(new Date("2026-09-29T00:00:00Z")), "2026-10-05T10:30:00.000Z");
 assert.equal(revealAtForAirTime(new Date("2026-09-28T03:59:00Z")), "2026-09-28T10:30:00.000Z");
});


test("schedule saves preserve published reveal dates and calculate Monday only for unpublished episodes", async t => {
 const originalEnv = { ...process.env };
 process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.example.test";
 process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-only";
 t.after(() => { process.env = originalEnv; });
 let published = true;
 const saved: Record<string, unknown>[] = [];
 t.mock.method(globalThis, "fetch", async (request: string | URL | Request, init?: RequestInit) => {
  const url = new URL(request instanceof Request ? request.url : String(request));
  const method = init?.method || "GET";
  if (url.pathname.endsWith("/picks") && method === "HEAD") return new Response(null, { headers: { "content-range": "0-0/1" } });
  if (url.pathname.endsWith("/popup_questions")) return Response.json(null);
  assert.ok(url.pathname.endsWith("/episodes"));
  if (method === "POST") {
   saved.push(JSON.parse(String(init?.body)));
   return Response.json(null);
  }
  assert.equal(method, "GET");
  if (url.searchParams.has("results_posted")) return Response.json(url.searchParams.get("results_posted") === "eq.false" ? null : []);
  if (url.searchParams.has("id")) return Response.json({ phase: "tribe", bonus_question: "Will an idol be played?", bonus_options: ["Yes", "No"], results_posted: published, results_published: published, reveal_at: "2026-09-24T13:00:00Z" });
  return Response.json([{ id: 1 }]);
 });
 for (const alreadyPublished of [true, false]) {
  published = alreadyPublished;
  const expected = published ? "2026-09-24T13:00:00Z" : "2026-09-28T10:30:00.000Z";
  const result = await scheduleEpisode({ episodeId: 1, title: "Episode 1", airAt: "2026-09-24T00:00:00Z", phase: "tribe", bonusQuestion: "Will an idol be played?", bonusOptions: ["Yes", "No"] });
  assert.equal(result.ok, true);
  assert.equal(result.revealAt, expected);
  assert.equal(saved.at(-1)?.reveal_at, expected);
  assert.equal(saved.at(-1)?.results_published, published);
 }
 assert.equal(saved.length, 2);
});
