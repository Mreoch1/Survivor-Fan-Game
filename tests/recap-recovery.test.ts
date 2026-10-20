import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../app/api/automation/recap/route";
import { input } from "./fixtures/season";

test("October 20 recovery retains Monday identity, live recipients and newly revealed points, then expires", async t => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-20T04:00:00Z") });
  const originalEnv = { ...process.env };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.example.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-only";
  process.env.AUTO_RESULTS_SECRET = "fixture-automation";
  t.after(() => { process.env = originalEnv; });
  const fixture = input();
  const airTimes = ["2026-09-24T00:00:00Z", "2026-10-01T00:00:00Z", "2026-10-08T00:00:00Z", "2026-10-15T00:00:00Z"];
  const reveals = ["2026-09-28T10:30:00Z", "2026-10-05T10:30:00Z", "2026-10-12T10:30:00Z", "2026-10-19T10:30:00Z"];
  let published = true;
  const queries: URL[] = [];
  t.mock.method(globalThis, "fetch", async (request: string | URL | Request, init?: RequestInit) => {
    const url = new URL(request instanceof Request ? request.url : String(request));
    queries.push(url);
    assert.equal(init?.method || "GET", "GET", "Recovery reads cannot publish results or change league records");
    if (url.pathname === "/auth/v1/admin/users") return Response.json({
      users: fixture.profiles.map(profile => ({ id: profile.id, email: `${profile.id}@current.example.test` })), aud: "authenticated",
    });
    const table = url.pathname.split("/").at(-1);
    if (table === "episodes") return Response.json(fixture.episodes.map((episode, index) => ({
      ...episode, title: "SECRET_EPISODE_TITLE", air_at: airTimes[index], reveal_at: reveals[index],
      results_published: episode.id === 4 ? published : true,
    })));
    if (table === "profiles") return Response.json(fixture.profiles);
    if (table === "popup_questions") {
      assert.equal(url.searchParams.get("reveal_at"), `lte.${new Date().toISOString()}`, "Scoring uses the real request time, not Monday's edition time");
      const question = { question: "SECRET_POPUP_QUESTION", details: "SECRET_SCOPE", opens_at: "2026-10-14T12:00:00Z", closes_at: "2026-10-14T23:00:00Z",
        points: 3, status: "resolved", correct_answer: "Yes", resolution_episode_id: 4 };
      return Response.json([
        { ...question, id: "late-monday", reveal_at: "2026-10-19T18:00:00Z" },
        { ...question, id: "still-hidden", reveal_at: "2026-10-21T05:00:00Z" },
      ]);
    }
    if (table === "popup_votes") {
      assert.equal(url.searchParams.get("question_id"), "in.(late-monday)", "Unrevealed awards stay hidden during recovery");
      return Response.json([{ question_id: "late-monday", user_id: "a", answer: "Yes", voted_at: "2026-10-14T13:00:00Z" }]);
    }
    if (table === "picks") return Response.json(fixture.picks);
    if (table === "episode_results") return Response.json(fixture.results);
    throw new Error(`Unexpected query: ${url.pathname}`);
  });
  const request = (token = "fixture-automation") => new Request("https://league.example.test/api/automation/recap", { headers: { authorization: `Bearer ${token}` } });
  assert.equal((await GET(request("wrong-token"))).status, 401);
  assert.equal(queries.length, 0, "The exception does not bypass authentication");

  for (const time of ["2026-10-20T04:00:00Z", "2026-10-20T18:00:00Z", "2026-10-21T03:59:59Z"]) {
    t.mock.timers.setTime(new Date(time).getTime());
    const response = await GET(request());
    const report = await response.json();
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(report.pending, true);
    assert.equal(report.editionId, "s51-week-2026-10-19");
    assert.deepEqual(report.episodeIds, [4]);
    assert.deepEqual(report.players.map((player: { email: string }) => player.email), ["a@current.example.test", "b@current.example.test"]);
    assert.equal(report.players[0].overallPoints, 24.5, "Points revealed after Monday 10 AM remain included");
    assert.deepEqual(report.players[0].rounds.map((round: { episodeId: number; points: number }) => [round.episodeId, round.points]), [[4, 4.5]]);
    assert.doesNotMatch(JSON.stringify(report), /SECRET_|still-hidden|late-monday|departures|finale_winner|immunity_pick/);
  }

  published = false;
  assert.equal((await (await GET(request())).json()).needsAttention, true, "Recovery still waits for the week's published results");
  published = true;
  for (const time of ["2026-10-21T04:00:00Z", "2026-10-27T18:00:00Z", "2026-09-29T18:00:00Z", "2026-10-19T13:59:59Z"]) {
    t.mock.timers.setTime(new Date(time).getTime());
    const queryCount: number = queries.length;
    assert.equal((await (await GET(request())).json()).pending, false);
    assert.equal(queries.length, queryCount, "Outside this exact recovery date normal closed windows do not access data");
  }
  t.mock.timers.setTime(new Date("2026-10-19T14:00:00Z").getTime());
  const monday = await (await GET(request())).json();
  assert.equal(monday.editionId, "s51-week-2026-10-19");
  assert.equal(monday.players[0].overallPoints, 21.5, "Normal Monday visibility still uses the actual time");
});
