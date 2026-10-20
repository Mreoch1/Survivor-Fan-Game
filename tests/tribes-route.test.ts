import assert from "node:assert/strict";
import test from "node:test";
import { GET, POST } from "../app/api/automation/tribes/route";
import { loadTribeOutcomeState, loadTribeState } from "../db/tribes";
import { BASELINE_TRIBE_STATE } from "../lib/tribes";

test("tribe endpoint guards context, preserves history, and verifies an idempotent published snapshot", async t => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-20T16:00:00Z") });
  const originalEnv = { ...process.env };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.example.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-only";
  process.env.AUTO_RESULTS_SECRET = "fixture-automation";
  t.after(() => { process.env = originalEnv; });
  const episodes = [
    { id: 3, title: "Episode 3", results_published: true, reveal_at: "2026-10-12T10:30:00Z", individual_game_started: false },
    { id: 4, title: "Episode 4", results_published: true, reveal_at: "2026-10-19T10:30:00Z", individual_game_started: false },
    { id: 5, title: "SECRET FUTURE EPISODE", results_published: false, reveal_at: "2026-10-26T10:30:00Z", individual_game_started: true },
    { id: 6, title: "SECRET EARLY PUBLISHED", results_published: true, reveal_at: "2026-11-02T11:30:00Z", individual_game_started: true },
  ];
  const baseRow = { after_episode_id: 3, phase: "tribe", tribes: BASELINE_TRIBE_STATE.tribes, assignments: BASELINE_TRIBE_STATE.assignments,
    sources: ["https://www.cbs.com/episode-3", "https://ew.com/episode-3"] };
  let snapshots = [baseRow];
  let missingTable = false;
  let race = false;
  let writes = 0;
  const queries: URL[] = [];
  t.mock.method(globalThis, "fetch", async (request: string | URL | Request, init?: RequestInit) => {
    const url = new URL(request instanceof Request ? request.url : String(request));
    queries.push(url);
    if (url.pathname.endsWith("/rpc/record_tribe_snapshot")) {
      writes += 1;
      assert.equal(init?.method, "POST");
      const body = JSON.parse(String(init?.body));
      assert.equal(body.p_expected_previous_episode_id, 3);
      if (race) return Response.json({ code: "40001", message: "context changed" }, { status: 409 });
      snapshots.push({ after_episode_id: body.p_after_episode_id, phase: body.p_phase, tribes: body.p_tribes, assignments: body.p_assignments, sources: body.p_sources });
      return Response.json(true);
    }
    assert.equal(init?.method || "GET", "GET", "Context reads must not publish results or update player state");
    if (url.pathname.endsWith("/episodes")) {
      assert.equal(url.searchParams.get("season"), "eq.51");
      assert.equal(url.searchParams.get("results_published"), "eq.true");
      assert.ok(url.searchParams.get("reveal_at")?.startsWith("lte."));
      return Response.json(episodes); // Deliberately broad response exercises the visibility defense.
    }
    if (url.pathname.endsWith("/tribe_snapshots")) {
      if (missingTable) return Response.json({ code: "42P01", message: "missing tribe_snapshots" }, { status: 404 });
      return Response.json([...snapshots, { ...baseRow, after_episode_id: 5, phase: "individual", assignments: { secret: "Never show" } }].sort((a, b) => b.after_episode_id - a.after_episode_id));
    }
    if (url.pathname.endsWith("/episode_results")) return Response.json([
      { episode_id: 3, departures: [{ castawayId: "patt-cannaday", type: "vote" }] },
      { episode_id: 4, departures: [{ castawayId: "jenna-greenawalt", type: "vote" }] },
    ]);
    throw new Error(`Unexpected request ${url.pathname}`);
  });
  const request = (body?: unknown) => new Request("https://league.example.test/api/automation/tribes", {
    method: body === undefined ? "GET" : "POST", headers: { authorization: "Bearer fixture-automation", "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  assert.equal((await GET(new Request("https://league.example.test/api/automation/tribes"))).status, 401);
  assert.equal(queries.length, 0);
  const response = await GET(request());
  const context = await response.json();
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(context.target.afterEpisodeId, 4);
  assert.equal(context.target.individualGameStarted, false);
  assert.equal(context.expectedPreviousAfterEpisodeId, 3);
  assert.equal(context.existingSnapshot, null);
  assert.doesNotMatch(JSON.stringify(context), /SECRET|Never show/);
  assert.equal(context.castaways.length, 21);
  assert.equal((await loadTribeState(3)).afterEpisodeId, 0);
  assert.equal((await loadTribeState(4)).afterEpisodeId, 3);
  assert.equal((await loadTribeOutcomeState(4)).afterEpisodeId, 3);

  const payload = { ...structuredClone(BASELINE_TRIBE_STATE), afterEpisodeId: 4, expectedPreviousAfterEpisodeId: 3,
    sources: ["https://www.cbs.com/episode-4", "https://ew.com/episode-4"] };
  assert.equal((await POST(request({ ...payload, afterEpisodeId: 3 }))).status, 409);
  assert.equal((await POST(request({ ...payload, expectedPreviousAfterEpisodeId: 0 }))).status, 409);
  assert.equal((await POST(request({ ...payload, phase: "individual" }))).status, 400);
  assert.equal((await POST(request({ ...payload, assignments: { ...payload.assignments, "patt-cannaday": "Savu" } }))).status, 400);
  assert.equal(writes, 0);
  const saved = await POST(request(payload));
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).updated, true);
  assert.equal(writes, 1);
  assert.equal((await loadTribeOutcomeState(4)).afterEpisodeId, 4);
  assert.equal((await loadTribeState(4)).afterEpisodeId, 3, "Past picks never receive their later swap");
  assert.equal((await loadTribeState()).afterEpisodeId, 4);
  const again = await POST(request(payload));
  assert.equal((await again.json()).updated, false);
  assert.equal(writes, 1);
  assert.equal((await POST(request({ ...payload, sources: ["https://www.cbs.com/changed", "https://ew.com/episode-4"] }))).status, 409);
  assert.equal(writes, 1);
  snapshots = [baseRow]; race = true;
  assert.equal((await POST(request(payload))).status, 409);
  missingTable = true;
  await assert.rejects(loadTribeState(), error => Boolean(error && typeof error === "object" && "code" in error && error.code === "42P01"));
});
