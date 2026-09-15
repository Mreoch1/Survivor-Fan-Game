import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../app/api/automation/recap/route";
import { input } from "./fixtures/season";

// Exercise the actual Supabase query and response boundary without production credentials.
test("recap route preserves scorecard totals and strips all spoiler fields", async t => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-09-28T14:00:00Z") });
  const originalEnv = { ...process.env };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.example.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-only";
  process.env.AUTO_RESULTS_SECRET = "fixture-automation";
  const fixture = input();
  let preseason = false;
  let hiddenWeek = false;
  const queries: URL[] = [];
  t.after(() => { process.env = originalEnv; });
  t.mock.method(globalThis, "fetch", async (request: string | URL | Request, init?: RequestInit) => {
    const url = new URL(request instanceof Request ? request.url : String(request));
    queries.push(url);
    assert.equal(init?.method || "GET", "GET", "Mail never publishes or changes scores");
    if (url.pathname === "/auth/v1/admin/users") {
      return Response.json({ users: fixture.profiles.map(profile => ({ id: profile.id, email: `${profile.id}@example.test` })), aud: "authenticated" });
    }
    const episodes = fixture.episodes.map(episode => ({ ...episode,
      air_at: new Date(new Date(episode.lock_at).getTime() + 3600000).toISOString(),
      title: "SECRET_EPISODE_TITLE", bonus_question: "SECRET_BONUS_QUESTION",
      ...(preseason ? { air_at: "2026-09-30T00:00:00Z", results_published: false } : {}),
      ...(hiddenWeek && episode.id === 4 ? { results_published: false } : {}),
    }));
    episodes.push({ ...episodes[0], id: 99, air_at: "2026-10-01T00:00:00Z", reveal_at: "2026-10-01T13:00:00Z", results_published: false });
    const table = url.pathname.split("/").at(-1);
    if (table === "episodes") return Response.json(episodes);
    if (table === "profiles") return Response.json(fixture.profiles);
    const ids = url.searchParams.get("episode_id")?.slice(4, -1).split(",").map(Number);
    assert.deepEqual(ids, [1, 2, 3, 4], "Only published episode IDs reach scoring queries");
    if (table === "picks") return Response.json(fixture.picks);
    if (table === "episode_results") return Response.json(fixture.results);
    throw new Error(`Unexpected query: ${url.pathname}`);
  });
  const request = () => new Request("https://league.example.test/api/automation/recap", { headers: { authorization: "Bearer fixture-automation" } });
  assert.equal((await GET(new Request("https://league.example.test/api/automation/recap"))).status, 401);
  const response = await GET(request());
  const report = await response.json();
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(report.pending, true);
  assert.equal(report.kind, "scores");
  assert.equal(report.players[0].overallPoints, 21.5);
  assert.equal(report.players[0].rounds.length, 4);
  assert.doesNotMatch(JSON.stringify(report), /SECRET_|favorite_id|Vote-Out|bonus_question|finale_winner|departures|Opening Outlast|Final Torch|Savu|safe|finalist/);
  assert.ok(queries.some(url => url.pathname.endsWith("episodes") && url.searchParams.get("season") === "eq.51"));
  hiddenWeek = true;
  assert.equal((await (await GET(request())).json()).needsAttention, true);
  preseason = true;
  const pre = await (await GET(request())).json();
  assert.equal(pre.kind, "preseason");
  assert.equal(pre.players[0].overallRank, null);
  assert.equal(pre.players[0].overallPoints, 0);
  t.mock.timers.setTime(new Date("2026-09-29T14:00:00Z").getTime());
  const count = queries.length;
  assert.equal((await (await GET(request())).json()).pending, false);
  assert.equal(queries.length, count, "Outside Monday no database or recipient lookup occurs");
});
