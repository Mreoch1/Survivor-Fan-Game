// Isolated HTTP fixtures exercise the compiled app's real auth and data-loading path.
// All writes below affect this process's in-memory fixtures only.
// This script uses no production credentials, records, or outbound messages.
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { input } from "../tests/fixtures/season";
import { castaways } from "../app/data";

const serve = process.argv.includes("--serve");
const appPort = Number(process.env.SMOKE_APP_PORT || 3107);
const fixturePort = Number(process.env.SMOKE_FIXTURE_PORT || 4357);
const appUrl = `http://127.0.0.1:${appPort}`;
const fixtureUrl = `http://127.0.0.1:${fixturePort}`;
const fixture = input();
const castIds: Record<string, string> = { safe: castaways[0].id, boot: castaways[1].id, finalist: castaways[2].id, winner: castaways[3].id, other: castaways[4].id };
const replaceIds = (value: unknown): unknown => Array.isArray(value) ? value.map(replaceIds) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceIds(item)])) : typeof value === "string" ? castIds[value] || value : value;
const profiles = fixture.profiles.map(profile => ({ ...replaceIds(profile) as typeof profile, total_points: 0, immunity_streak: 0, longest_streak: 0, league_joined_at: "2025-09-01T00:00:00Z", created_at: "2025-09-01T00:00:00Z" }));
const episodes = fixture.episodes.map(episode => ({ ...episode, air_at: episode.lock_at.replace("2026", "2025"), lock_at: episode.lock_at.replace("2026", "2025"), reveal_at: episode.reveal_at.replace("2026", "2025"), bonus_options: ["Yes", "No"], results_posted: true }));
const picks = (replaceIds(fixture.picks) as typeof fixture.picks).map(pick => ({ ...pick, immunity_pick: pick.episode_id > 2 ? castaways[3].id : pick.immunity_pick }));
const results = replaceIds(fixture.results) as typeof fixture.results;
const hidden = { ...episodes[0], id: 99, title: "HIDDEN_FUTURE_EPISODE", individual_game_started: true, results_published: false, reveal_at: "2999-01-01T13:00:00Z" };
let emptySeason = false;
let playMode = false;
let negativeRound = false;
type Row = Record<string, unknown>;
const playEpisodes: Row[] = [...episodes, { ...episodes[3], id: 5, title: "Preview predictions", individual_game_started: false, results_posted: false, results_published: false, lock_at: "2999-01-01T23:00:00Z", air_at: "2999-01-02T00:00:00Z", reveal_at: "2999-01-02T13:00:00Z", bonus_question: "Will an idol be found?" }];
const playPicks: Row[] = structuredClone(picks);
const queries: string[] = [];

const fixtureSigningKey = randomBytes(32);
function sessionFor(id: string) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const payload = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: id, email: `${id}@example.test`, aud: "authenticated", role: "authenticated", exp: 4102444800, iat: 1700000000 })}`;
  const token = `${payload}.${createHmac("sha256", fixtureSigningKey).update(payload).digest("base64url")}`;
  return { access_token: token, refresh_token: "local-smoke-refresh", expires_at: 4102444800, expires_in: 3600, token_type: "bearer", user: { id, email: `${id}@example.test` } };
}
const cookieFor = (id: string) => `sb-127-auth-token=base64-${Buffer.from(JSON.stringify(sessionFor(id))).toString("base64url")}`;

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", fixtureUrl);
  response.setHeader("content-type", "application/json");
  if (url.pathname === "/sign-in") {
    response.writeHead(302, { "set-cookie": `${cookieFor("a")}; Path=/; HttpOnly; SameSite=Lax`, location: `${appUrl}/season` });
    return response.end();
  }
  if (url.pathname === "/auth/v1/user") {
    const auth = request.headers.authorization?.replace("Bearer ", "");
    const id = ["a", "outsider"].find(candidate => sessionFor(candidate).access_token === auth);
    if (!id) { response.statusCode = 401; return response.end(JSON.stringify({ message: "Invalid fixture token" })); }
    return response.end(JSON.stringify({ id, email: `${id}@example.test`, user_metadata: { display_name: "Smoke Player" } }));
  }
  if (!url.pathname.startsWith("/rest/v1/")) { response.statusCode = 404; return response.end("{}"); }
  const table = url.pathname.split("/").at(-1)!;
  const writing = request.method !== "GET" && request.method !== "HEAD";
  if (writing && (!playMode || !["picks", "profiles", "episodes"].includes(table))) {
    response.statusCode = 405;
    return response.end(JSON.stringify({ message: "Smoke database is read-only" }));
  }
  queries.push(url.pathname + url.search);
  const scoredPicks = negativeRound ? picks.map(pick => pick.user_id === "a" && pick.episode_id === 4 ? { ...pick, favorite_point: 0, immunity_point: 0, bonus_point: -1 } : pick) : picks;
  const scoredResults = negativeRound ? results.map(result => ({ ...result, finale_winner: null, finalists: [] })) : results;
  const tables: Record<string, unknown[]> = { profiles, episodes: emptySeason ? [] : playMode ? playEpisodes : [...episodes, hidden], picks: playMode ? playPicks : [...scoredPicks, { ...picks[0], episode_id: 99, favorite_id: "SECRET_FUTURE_PICK", favorite_point: 99 }], episode_results: playMode ? results : [...scoredResults, { ...results[0], episode_id: 99, finale_winner: "SECRET_FUTURE_WINNER" }], private_messages: [] };
  let rows = (tables[table] || []) as Row[];
  for (const [field, filter] of url.searchParams) {
    if (["select", "order", "limit", "offset", "on_conflict"].includes(field)) continue;
    const compare = (row: Record<string, unknown>) => {
      const value = String(row[field]);
      if (filter === "not.is.null") return row[field] != null;
      if (filter === "is.null") return row[field] == null;
      if (filter.startsWith("eq.")) return value === filter.slice(3);
      if (filter.startsWith("neq.")) return value !== filter.slice(4);
      if (filter.startsWith("lte.")) return value <= filter.slice(4);
      if (filter.startsWith("lt.")) return typeof row[field] === "number" ? Number(row[field]) < Number(filter.slice(3)) : value < filter.slice(3);
      if (filter.startsWith("gt.")) return typeof row[field] === "number" ? Number(row[field]) > Number(filter.slice(3)) : value > filter.slice(3);
      if (filter.startsWith("in.(")) return filter.slice(4, -1).split(",").includes(value);
      throw new Error(`Unsupported smoke filter: ${filter}`);
    };
    rows = rows.filter(compare);
  }
  if (writing) {
    let raw = "";
    for await (const chunk of request) raw += chunk;
    const body = JSON.parse(raw) as Row;
    if (request.method === "PATCH" && table === "profiles") {
      const key = (value: unknown) => String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
      if (body.team_name && profiles.some(profile => !rows.includes(profile) && key(profile.team_name) === key(body.team_name))) {
        response.statusCode = 409;
        return response.end(JSON.stringify({ code: "23505", message: 'duplicate key value violates unique constraint "profiles_team_name_unique"' }));
      }
      rows.forEach(row => Object.assign(row, body));
    } else if (request.method === "POST" && ["picks", "episodes"].includes(table)) {
      const destination = table === "picks" ? playPicks : playEpisodes;
      const existing = destination.find(row => table === "picks" ? row.user_id === body.user_id && row.episode_id === body.episode_id : row.id === body.id);
      if (existing) Object.assign(existing, body);
      else destination.push(body);
      rows = [existing || body];
    } else {
      response.statusCode = 405;
      return response.end(JSON.stringify({ message: "Unexpected fixture write" }));
    }
  }
  const ordering = url.searchParams.get("order")?.split(",") || [];
  rows = [...rows].sort((a, b) => {
    for (const rule of ordering) {
      const [field, direction] = rule.split(".");
      const left = a[field] as string | number, right = b[field] as string | number;
      if (left !== right) return (left < right ? -1 : 1) * (direction === "desc" ? -1 : 1);
    }
    return 0;
  });
  const total = rows.length;
  const offset = Number(url.searchParams.get("offset") || 0);
  rows = rows.slice(offset, offset + Number(url.searchParams.get("limit") || 1000));
  const selection = url.searchParams.get("select");
  if (selection && selection !== "*") rows = rows.map(row => Object.fromEntries(selection.split(",").map(field => [field, row[field]])));
  response.setHeader("content-range", `0-${Math.max(rows.length - 1, 0)}/${total}`);
  if (request.method === "HEAD") return response.end();
  const single = request.headers.accept?.includes("vnd.pgrst.object+json");
  response.end(JSON.stringify(single ? rows[0] || null : rows));
});
server.listen(fixturePort, "127.0.0.1");
await once(server, "listening");
const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(appPort)], {
  env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: fixtureUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture-anon", SUPABASE_SERVICE_ROLE_KEY: "fixture-service", NEXT_PUBLIC_SITE_URL: appUrl, AUTO_RESULTS_SECRET: "fixture-automation", LEAGUE_INVITE_CODE: "fixture-invite" },
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
app.stdout.on("data", data => { logs += String(data); });
app.stderr.on("data", data => { logs += String(data); });
const close = () => { app.kill(); server.close(); };
process.on("SIGINT", () => { close(); process.exit(0); });
process.on("SIGTERM", () => { close(); process.exit(0); });
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(`${appUrl}/rules`)).ok) { ready = true; break; } } catch { /* Wait for startup. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, "Production server starts");
  const anonymous = await fetch(`${appUrl}/season`, { redirect: "manual" });
  const anonymousHtml = await anonymous.text();
  assert.ok([200, 307].includes(anonymous.status));
  assert.match((anonymous.headers.get("location") || "") + anonymousHtml, /login\?returnTo=%2Fseason/);
  assert.doesNotMatch(anonymousHtml, /Camp Alpha|Camp Bravo|SECRET_FUTURE/);
  const outsider = await fetch(`${appUrl}/season`, { headers: { cookie: cookieFor("outsider") } });
  const outsiderHtml = await outsider.text();
  assert.match(outsiderHtml, /Join the tribe to start your season/);
  assert.doesNotMatch(outsiderHtml, /Camp Alpha|Camp Bravo|SECRET_FUTURE/);
  const member = await fetch(`${appUrl}/season`, { headers: { cookie: cookieFor("a") } });
  assert.equal(member.status, 200);
  const html = await member.text();
  assert.match(html, /Your season scorecard/);
  assert.match(html, /21\.5/);
  assert.match(html, /Leaderboard/);
  assert.doesNotMatch(html, /Post-merge championship|Your second chance|POST-MERGE/);
  assert.match(html, /Final Torch Pick/);
  assert.match(html, /1\.5/);
  assert.doesNotMatch(html, /SECRET_FUTURE|HIDDEN_FUTURE|could not load/);
  assert.ok(queries.some(query => query.includes("results_published=eq.true") && query.includes("reveal_at=lte.")), "Published/reveal filtering reaches the database");
  const campfire = await fetch(`${appUrl}/campfire`, { headers: { cookie: cookieFor("a") } });
  assert.match(await campfire.text(), /Episode 4 league highlights/);
  emptySeason = true;
  const empty = await fetch(`${appUrl}/season`, { headers: { cookie: cookieFor("a") } });
  assert.match(await empty.text(), /Your story starts with a pick/);
  emptySeason = false;
  negativeRound = true;
  const negative = await fetch(`${appUrl}/season`, { headers: { cookie: cookieFor("a") } });
  const negativeHtml = await negative.text();
  assert.match(negativeHtml, /class="episode-points">-1<small>POINTS/);
  assert.doesNotMatch(negativeHtml, /\+(?:<!-- -->)?-1/);
  negativeRound = false;
  playMode = true;
  const headers = { cookie: cookieFor("a"), "content-type": "application/json" };
  const league = async () => {
    const response = await fetch(`${appUrl}/api/league`, { headers });
    assert.equal(response.status, 200);
    return response.json();
  };
  const carried = await league();
  assert.equal(carried.episode.id, 5);
  assert.equal(carried.episode.bonusQuestion, "Will an idol be found?");
  assert.equal(carried.pick.bootPick, castIds.boot);
  assert.equal(carried.pick.carriedFromEpisodeId, 4);
  assert.equal(carried.pick.bonusPick, "", "An old Yes answer never risks a point in a new episode");
  assert.equal(carried.pick.shotInTheDark, "");
  await league();
  assert.equal(playPicks.filter(pick => pick.episode_id === 5).length, 2, "Repeated reads do not duplicate carried picks");
  const core = { episodeId: 5, favoriteId: castIds.safe, immunityPick: castIds.winner, bootPick: castIds.boot, bonusPick: "" };
  const savePick = (body: object) => fetch(`${appUrl}/api/picks`, { method: "PUT", headers, body: JSON.stringify(body) });
  const missing = await savePick({ ...core, bootPick: "" });
  assert.equal(missing.status, 400);
  assert.match((await missing.json()).error, /Vote-Out/);
  assert.equal((await league()).pick.carriedFromEpisodeId, 4, "Rejected save leaves existing picks untouched");
  assert.equal((await savePick(core)).status, 200, "All three required picks can be saved while skipping the optional risk");
  assert.equal((await league()).pick.bonusPick, "");
  assert.equal((await savePick({ ...core, bonusPick: "Yes" })).status, 200);
  assert.equal((await league()).pick.bonusPick, "Yes");
  assert.equal((await savePick(core)).status, 200);
  assert.equal((await league()).pick.bonusPick, "", "Skip explicitly clears a previously saved answer");
  assert.equal((await savePick({ ...core, bonusPick: "Maybe" })).status, 400);
  assert.equal((await savePick({ ...core, shotInTheDark: "bonus" })).status, 400);
  const profileBody = { displayName: "Alex", avatarKey: "torch", teamName: "  cAmP   bRaVo " };
  const duplicate = await fetch(`${appUrl}/api/profile`, { method: "PUT", headers, body: JSON.stringify(profileBody) });
  assert.equal(duplicate.status, 409);
  assert.match((await duplicate.json()).error, /already taken/);
  const duplicateJoin = await fetch(`${appUrl}/api/league`, { method: "POST", headers, body: JSON.stringify(profileBody) });
  assert.equal(duplicateJoin.status, 409, "Joining cannot bypass unique team names");
  const ownName = await fetch(`${appUrl}/api/profile`, { method: "PUT", headers, body: JSON.stringify({ ...profileBody, teamName: " Camp   Alpha " }) });
  assert.equal(ownName.status, 200, "Keeping your own team name is allowed");
  assert.equal((await ownName.json()).profile.teamName, "Camp Alpha");
  const schedule = (body: object) => fetch(`${appUrl}/api/automation/commissioner`, { method: "POST", headers: { authorization: "Bearer fixture-automation", "content-type": "application/json" }, body: JSON.stringify(body) });
  const scheduled = await schedule({ episodeId: 6, title: "Default question", airAt: "2999-01-09T00:00:00Z", phase: "individual" });
  assert.equal(scheduled.status, 200);
  const defaultEpisode = await scheduled.json();
  assert.equal(defaultEpisode.bonusQuestion, "Will an idol be played?");
  assert.deepEqual(defaultEpisode.bonusOptions, ["Yes", "No"]);
  const previewEpisode = await schedule({ episodeId: 7, title: "A new preview", airAt: "2999-01-16T00:00:00Z", phase: "individual", bonusQuestion: "Will an idol be found?", bonusOptions: ["Yes", "No"] });
  assert.equal(previewEpisode.status, 200);
  assert.equal((await previewEpisode.json()).bonusQuestion, "Will an idol be found?", "A preview question overrides the default");
  const context = await fetch(`${appUrl}/api/automation/commissioner`, { headers: { authorization: "Bearer fixture-automation" } });
  assert.equal((await context.json()).target.choicesFrozen, true, "Commissioner can identify a frozen question before attempting changes");
  const frozen = await schedule({ episodeId: 5, title: "Preview predictions", airAt: "2999-01-02T00:00:00Z", phase: "individual", bonusQuestion: "Will an idol be played?", bonusOptions: ["Yes", "No"] });
  assert.equal(frozen.status, 409, "Question wording cannot change after picks exist");
  assert.equal((await league()).episode.bonusQuestion, "Will an idol be found?");
  console.log("Season and weekly-pick smoke passed: auth, scores, spoilers, negative totals, required Vote-Out, optional advantage save/skip, fresh carryover, unique names, default question, and frozen saved questions.");
  if (serve) {
    console.log(`Visual review: ${fixtureUrl}/sign-in`);
    await new Promise(() => {});
  }
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  close();
}
