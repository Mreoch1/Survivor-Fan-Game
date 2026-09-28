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
import { publishedUpdates } from "../lib/league-updates";
import { DEFAULT_ADVANTAGE_QUESTION } from "../lib/advantage-question";

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
let castReviewMode = false;
let castQueryFailure: "episodes" | "episode_results" | null = null;
let eliminatedStatusMode = false;
let prematureStatusMode = false;
let departureLabelsFailure = false;
let serveDepartedCard = false;
const departureCast = { voted: castaways[1], medical: castaways[5], quit: castaways[6], hidden: castaways[7], early: castaways[8] };
const revealedDepartures = [
  { castawayId: departureCast.voted.id, type: "vote" },
  { castawayId: departureCast.medical.id, type: "medical" },
  { castawayId: departureCast.quit.id, type: "quit" },
];
const castReviewEpisodes = [
  episodes[0],
  { ...hidden, id: 98, reveal_at: "2025-01-01T13:00:00Z" },
  { ...hidden, results_published: true },
];
const castReviewResults = [
  { ...results[0], departures: revealedDepartures },
  { ...results[0], episode_id: 98, departures: [{ castawayId: departureCast.hidden.id, type: "vote" }] },
  { ...results[0], episode_id: 99, departures: [{ castawayId: departureCast.early.id, type: "vote" }] },
];
type Row = Record<string, unknown>;
const playEpisodes: Row[] = [...episodes, { ...episodes[3], id: 5, title: "Preview predictions", individual_game_started: false, results_posted: false, results_published: false, lock_at: "2999-01-01T23:00:00Z", air_at: "2999-01-02T00:00:00Z", reveal_at: "2999-01-02T13:00:00Z", bonus_question: "Will an idol be found?" }];
const playPicks: Row[] = structuredClone(picks);
const queries: string[] = [];
let resultTables: Record<string, Row[]> | null = null;
let resultWriteFailure: { table: string; id?: string } | null = null;
function freshResultTables(): Record<string, Row[]> {
  const members = ["a", "b", "skipped"];
  return {
    profiles: members.map((id, index) => ({ ...profiles[index % profiles.length], id, total_points: 0, immunity_streak: 0, longest_streak: 0 })),
    episodes: [{ ...episodes[0], id: 8, results_posted: false, results_published: false }],
    picks: members.map((id, index) => ({ ...picks[0], id: `result-${id}`, user_id: id, episode_id: 8, bonus_pick: ["Yes", "No", ""][index], double_down: index < 2 ? "bonus" : "", favorite_point: 0, immunity_point: 0, boot_point: 0 })),
    episode_results: [],
    cast_status: [],
  };
}

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
    const id = ["a", "b", "outsider"].find(candidate => sessionFor(candidate).access_token === auth);
    if (!id) { response.statusCode = 401; return response.end(JSON.stringify({ message: "Invalid fixture token" })); }
    return response.end(JSON.stringify({ id, email: `${id}@example.test`, user_metadata: { display_name: "Smoke Player" } }));
  }
  if (!url.pathname.startsWith("/rest/v1/")) { response.statusCode = 404; return response.end("{}"); }
  const table = url.pathname.split("/").at(-1)!;
  const writing = request.method !== "GET" && request.method !== "HEAD";
  const writable = resultTables ? ["picks", "profiles", "episodes", "episode_results", "cast_status"].includes(table) : playMode && ["picks", "profiles", "episodes"].includes(table);
  if (writing && !writable) {
    response.statusCode = 405;
    return response.end(JSON.stringify({ message: "Smoke database is read-only" }));
  }
  queries.push(url.pathname + url.search);
  if ((castReviewMode && table === castQueryFailure) || (departureLabelsFailure && table === "episodes" && url.searchParams.get("select") === "id,reveal_at,results_published")) {
    response.statusCode = 503;
    return response.end(JSON.stringify({ message: "Cast fixture query unavailable" }));
  }
  const scoredPicks = picks.map(pick => pick.user_id === "b" ? {
    ...pick, favorite_id: "PRIVATE_OTHER_FAVORITE", immunity_pick: "PRIVATE_OTHER_IMMUNITY",
    boot_pick: "PRIVATE_OTHER_VOTE", bonus_pick: "PRIVATE_OTHER_ANSWER", double_down: "boot",
  } : negativeRound && pick.episode_id === 4 ? { ...pick, favorite_point: 0, immunity_point: 0, bonus_point: -1 } : pick);
  const scoredResults = negativeRound ? results.map(result => ({ ...result, finale_winner: null, finalists: [] })) : results;
  const departedStatuses = revealedDepartures.map(departure => ({ castaway_id: departure.castawayId, status: "eliminated" }));
  if (prematureStatusMode) departedStatuses.push(...[departureCast.hidden, departureCast.early].map(castaway => ({ castaway_id: castaway.id, status: "eliminated" })));
  const departedEpisodes = [...playEpisodes, { ...hidden, id: 98 }, { ...hidden, results_published: true }];
  const departedResults = [...results.map(result => result.episode_id === 1 ? { ...result, departures: revealedDepartures } : result), ...castReviewResults.slice(1)];
  const tables: Record<string, unknown[]> = { league_update_acknowledgements: serve ? profiles.flatMap(profile => publishedUpdates().map(update => ({ user_id: profile.id, update_id: update.id }))) : [], profiles, cast_status: eliminatedStatusMode ? departedStatuses : serveDepartedCard ? [{ castaway_id: departureCast.voted.id, status: "eliminated" }] : [], episodes: castReviewMode ? castReviewEpisodes : eliminatedStatusMode ? departedEpisodes : emptySeason ? [] : playMode ? playEpisodes : [...episodes, hidden], picks: playMode ? playPicks : [...scoredPicks, { ...picks[0], episode_id: 99, favorite_id: "SECRET_FUTURE_PICK", favorite_point: 99 }], episode_results: castReviewMode ? castReviewResults : eliminatedStatusMode ? departedResults : playMode ? results : [...scoredResults, { ...results[0], episode_id: 99, finale_winner: "SECRET_FUTURE_WINNER" }], private_messages: [] };
  Object.assign(tables, resultTables);
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
    if (resultTables) {
      if (resultWriteFailure?.table === table && (!resultWriteFailure.id || rows.some(row => row.id === resultWriteFailure?.id))) {
        response.statusCode = 503;
        return response.end(JSON.stringify({ message: "Simulated results write failure" }));
      }
      if (request.method === "PATCH" && ["picks", "profiles", "episodes"].includes(table)) {
        rows.forEach(row => Object.assign(row, body));
      } else if (request.method === "POST" && ["episode_results", "cast_status"].includes(table)) {
        const key = table === "episode_results" ? "episode_id" : "castaway_id";
        const existing = resultTables[table].find(row => row[key] === body[key]);
        if (existing) Object.assign(existing, body);
        else resultTables[table].push(body);
        rows = [existing || body];
      } else {
        response.statusCode = 405;
        return response.end(JSON.stringify({ message: "Unexpected result fixture write" }));
      }
    } else if (request.method === "PATCH" && table === "profiles") {
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
  env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: fixtureUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture-anon", SUPABASE_SERVICE_ROLE_KEY: "fixture-service", NEXT_PUBLIC_SITE_URL: appUrl, AUTO_RESULTS_SECRET: "fixture-automation", LEAGUE_INVITE_CODE: "fixture-invite", COMMISSIONER_EMAILS: "a@example.test" },
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
  assert.match(html, /points by episode/);
  assert.match(html, /Season points/);
  assert.match(html, /Rank change/);
  assert.match(html, /switched pick earns half points/);
  assert.doesNotMatch(html, /PRIVATE_OTHER_/);
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
  assert.deepEqual(carried.departedCastaways, [], "An active choice is never duplicated as an eliminated card");
  assert.deepEqual(carried.leaderboard.map((row: { id: string; points: number; rank: number }) => [row.id, row.points, row.rank]), [["a", 21.5, 1], ["b", 20, 2]], "Play uses the same published totals/ranks as My Season, not stale profile totals");
  assert.ok(profiles.every(profile => profile.total_points === 0), "Reading the leaderboard does not repair or mutate stored scores");
  assert.ok(carried.leaderboard.every((row: Record<string, unknown>) => !("episodes" in row) && !("rows" in row) && !("history" in row)), "Play receives only leaderboard summaries");
  assert.doesNotMatch(JSON.stringify(carried.leaderboard), /favorite_id|immunity_pick|boot_pick|bonus_pick|selection|PRIVATE_OTHER_|SECRET_FUTURE/);
  assert.equal(carried.episode.bonusQuestion, "Will an idol be found?");
  assert.equal(carried.pick.bootPick, castIds.boot);
  assert.equal(carried.pick.carriedFromEpisodeId, 4);
  assert.equal(carried.pick.bonusPick, "", "An old Yes answer never risks a point in a new episode");
  assert.equal(carried.pick.shotInTheDark, "");
  const publicHomeResponse = await fetch(appUrl);
  assert.equal(publicHomeResponse.status, 200);
  const publicHome = (await publicHomeResponse.text()).replaceAll("<!-- -->", "");
  assert.match(publicHome, /Episode 5 · Preview predictions/);
  assert.match(publicHome, /Sign in to make picks/);
  assert.doesNotMatch(publicHome, /Camp Alpha|Camp Bravo|PRIVATE_OTHER_|SECRET_FUTURE|Camp Chaos|Blindside Club/);
  assert.doesNotMatch(publicHome, new RegExp(`${castIds.safe}|${castIds.boot}`), "Anonymous home does not serialize pick values");
  const carriedHomeResponse = await fetch(appUrl, { headers });
  assert.equal(carriedHomeResponse.status, 200);
  const carriedHome = (await carriedHomeResponse.text()).replaceAll("<!-- -->", "");
  assert.match(carriedHome, /Episode 5 · Preview predictions/);
  assert.match(carriedHome, /Picks carried forward/);
  assert.match(carriedHome, /Carried from Episode 4/);
  assert.match(carriedHome, /3 of 3 required picks on file/);
  assert.match(carriedHome, /Scores through Episode 4/);
  assert.match(carriedHome, /class="home-score"><strong>21\.5<\/strong>/, "Home uses canonical published scores instead of cached zero profile totals");
  assert.match(carriedHome, /Camp Alpha/);
  assert.doesNotMatch(carriedHome, /PRIVATE_OTHER_|SECRET_FUTURE|Camp Chaos|Blindside Club/);
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
  const savedHome = (await (await fetch(appUrl, { headers })).text()).replaceAll("<!-- -->", "");
  assert.match(savedHome, /Your picks are saved/);
  assert.match(savedHome, /3 of 3 required picks on file/);
  assert.doesNotMatch(savedHome, /Picks carried forward|Carried from Episode 4/);
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
  const tooLong = await schedule({ episodeId: 6, title: "Overlong question", airAt: "2999-01-09T00:00:00Z", phase: "individual", bonusQuestion: `${DEFAULT_ADVANTAGE_QUESTION} Another scoring condition.`, bonusOptions: ["Yes", "No"] });
  assert.equal(tooLong.status, 400, "Question conditions must never be silently truncated");
  assert.match((await tooLong.json()).error, /140 characters/);
  const scheduled = await schedule({ episodeId: 6, title: "Default question", airAt: "2999-01-09T00:00:00Z", phase: "individual" });
  assert.equal(scheduled.status, 200);
  const defaultEpisode = await scheduled.json();
  assert.equal(defaultEpisode.bonusQuestion, DEFAULT_ADVANTAGE_QUESTION);
  assert.ok(defaultEpisode.bonusQuestion.length <= 140, "The complete default must fit without dropping its scoring conditions");
  assert.deepEqual(defaultEpisode.bonusOptions, ["Yes", "No"]);
  const releaseTime = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/Detroit", weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(defaultEpisode.revealAt)).map(part => [part.type, part.value]));
  assert.deepEqual([releaseTime.weekday, releaseTime.hour, releaseTime.minute], ["Monday", "06", "30"], "New episodes release results Monday at 6:30 AM Eastern");
  const previewEpisode = await schedule({ episodeId: 7, title: "A new preview", airAt: "2999-01-16T00:00:00Z", phase: "individual", bonusQuestion: "Will an idol be found?", bonusOptions: ["Yes", "No"] });
  assert.equal(previewEpisode.status, 200);
  assert.equal((await previewEpisode.json()).bonusQuestion, "Will an idol be found?", "A preview question overrides the default");
  const context = await fetch(`${appUrl}/api/automation/commissioner`, { headers: { authorization: "Bearer fixture-automation" } });
  assert.equal((await context.json()).target.choicesFrozen, true, "Commissioner can identify a frozen question before attempting changes");
  const frozen = await schedule({ episodeId: 5, title: "Preview predictions", airAt: "2999-01-02T00:00:00Z", phase: "individual", bonusQuestion: "Will an idol be played?", bonusOptions: ["Yes", "No"] });
  assert.equal(frozen.status, 409, "Question wording cannot change after picks exist");
  assert.equal((await league()).episode.bonusQuestion, "Will an idol be found?");
  const publishedReveal = episodes[0].reveal_at;
  const savedPublished = await schedule({ episodeId: 1, title: episodes[0].title, airAt: episodes[0].air_at, phase: episodes[0].phase, bonusQuestion: episodes[0].bonus_question, bonusOptions: ["Yes", "No"] });
  assert.equal(savedPublished.status, 200);
  assert.equal((await savedPublished.json()).revealAt, publishedReveal, "Saving published episode metadata preserves its historical reveal time");
  assert.equal(playEpisodes[0].reveal_at, publishedReveal);
  castReviewMode = true;
  const castQueryStart = queries.length;
  const castResponse = await fetch(`${appUrl}/cast`);
  assert.equal(castResponse.status, 200);
  const castHtml = (await castResponse.text()).replaceAll("<!-- -->", "");
  const castCards = castHtml.match(/<article\b[^>]*>[\s\S]*?<\/article>/g) || [];
  assert.equal(castCards.length, castaways.length, "Cast page keeps every original castaway card");
  const cardFor = (name: string) => {
    const card = castCards.find(card => card.includes(`<h2>${name}</h2>`));
    assert.ok(card, `Card is present for ${name}`);
    return card;
  };
  const votedCard = cardFor(departureCast.voted.name);
  assert.match(votedCard, /cast-departure-x/);
  assert.match(votedCard, /Voted out/);
  assert.match(votedCard, /Not available for picks/);
  for (const departed of [departureCast.medical, departureCast.quit]) {
    const card = cardFor(departed.name);
    assert.match(card, /cast-departure-x/);
    assert.match(card, /Left the game/);
    assert.match(card, /Not available for picks/);
    assert.doesNotMatch(card, /Voted out/, "Medical removals and quits are never described as vote-outs");
  }
  for (const unrevealed of [departureCast.hidden, departureCast.early, castaways[0]]) {
    assert.doesNotMatch(cardFor(unrevealed.name), /cast-departed|cast-departure-x|Voted out|Left the game|Not available for picks/, "Unpublished, early-published, and active castaways remain unmarked");
  }
  assert.ok(queries.slice(castQueryStart).some(query => query.includes("results_published=eq.true") && query.includes("reveal_at=lte.")), "Cast departure query enforces both spoiler gates");
  for (const table of ["episodes", "episode_results"] as const) {
    castQueryFailure = table;
    const failedCastResponse = await fetch(`${appUrl}/cast`);
    assert.equal(failedCastResponse.status, 200, "A status outage preserves the cast page");
    const failedCast = (await failedCastResponse.text()).replaceAll("<!-- -->", "");
    assert.match(failedCast, /status[^<]*unavailable/i);
    const neutralCards = failedCast.match(/<article\b[^>]*>[\s\S]*?<\/article>/g) || [];
    assert.equal(neutralCards.length, castaways.length);
    for (const card of neutralCards) {
      assert.doesNotMatch(card, /cast-departed|cast-departure-x|Voted out|Left the game|Still in the game|Not available for picks|Available for picks/, "Unknown status cannot claim a castaway is active or eliminated");
    }
  }
  castQueryFailure = null;
  castReviewMode = false;

  eliminatedStatusMode = true;
  const picksBeforeRejectedDepartures = JSON.stringify(playPicks);
  const eligibleLeague = await league();
  assert.deepEqual(eligibleLeague.departedCastaways.map((castaway: { id: string; status: string; departureLabel: string }) => [castaway.id, castaway.status, castaway.departureLabel]), [
    [departureCast.voted.id, "eliminated", "Voted out"],
    [departureCast.medical.id, "eliminated", "Left the game"],
    [departureCast.quit.id, "eliminated", "Left the game"],
  ], "Weekly Favorite receives only revealed departed cards with accurate labels");
  assert.doesNotMatch(JSON.stringify(eligibleLeague.departedCastaways), /favorite_id|immunity_pick|boot_pick|bonus_pick|selection|PRIVATE_OTHER_|SECRET_FUTURE/);
  assert.ok(eligibleLeague.departedCastaways.every((departed: { id: string }) => !eligibleLeague.castaways.some((active: { id: string }) => active.id === departed.id)), "Disabled cards never enter the active-only dropdown collection");
  prematureStatusMode = true;
  const earlyStatuses = await league();
  assert.ok(earlyStatuses.departedCastaways.every((castaway: { id: string }) => ![departureCast.hidden.id, departureCast.early.id].includes(castaway.id)), "Unpublished and future results cannot label a departure even if cast status was changed early");
  prematureStatusMode = false;
  departureLabelsFailure = true;
  const labelsUnavailable = await league();
  assert.deepEqual(labelsUnavailable.departedCastaways, [], "Unavailable departure labels are never guessed");
  assert.deepEqual(labelsUnavailable.castaways, eligibleLeague.castaways, "A label outage preserves the existing eligible choices");
  departureLabelsFailure = false;
  for (const departure of revealedDepartures) {
    assert.ok(!eligibleLeague.castaways.some((castaway: { id: string }) => castaway.id === departure.castawayId), "All revealed departed castaways are unavailable for new picks");
  }
  assert.ok(eligibleLeague.castaways.some((castaway: { id: string }) => castaway.id === departureCast.hidden.id), "Hidden future departures do not remove a castaway from choices");
  const activePicks = { ...core, bootPick: castIds.other };
  for (const departure of revealedDepartures) {
    const rejected = await savePick({ ...activePicks, favoriteId: departure.castawayId });
    assert.equal(rejected.status, 400);
    assert.match((await rejected.json()).error, /already left the game/);
  }
  for (const field of ["immunityPick", "bootPick"]) {
    const rejected = await savePick({ ...activePicks, [field]: departureCast.voted.id });
    assert.equal(rejected.status, 400);
    assert.match((await rejected.json()).error, /already left the game/);
  }
  assert.equal(JSON.stringify(playPicks), picksBeforeRejectedDepartures, "Rejected eliminated picks preserve the existing saved selections");
  eliminatedStatusMode = false;

  resultTables = freshResultTables();
  const adminResult = { action: "results", episodeId: 8, booted: castIds.boot, immunityWinner: "Savu" };
  const submitResult = (body: object, cookie = cookieFor("a")) => fetch(`${appUrl}/api/admin`, {
    method: "POST", headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body),
  });
  const unchangedResultState = JSON.stringify(resultTables);
  for (const cookie of ["", cookieFor("b")]) {
    assert.equal((await submitResult({ ...adminResult, voidBonusQuestion: "on" }, cookie)).status, 403, "Only a commissioner can void a question");
  }
  for (const extra of [{}, { bonusAnswer: "" }, { voidBonusQuestion: true }, { voidBonusQuestion: "true" }, { voidBonusQuestion: "on", bonusAnswer: "Yes" }]) {
    assert.equal((await submitResult({ ...adminResult, ...extra })).status, 400, "Voiding requires the exact explicit checkbox and no conflicting answer");
  }
  const automationResult = { episodeId: 8, departures: [{ castawayId: castIds.boot, type: "vote" }], immunityWinners: ["Savu"] };
  for (const extra of [{}, { bonusAnswer: "" }, { voidBonusQuestion: true }, { bonusAnswer: "", voidBonusQuestion: "on" }]) {
    const rejected = await fetch(`${appUrl}/api/automation/results`, {
      method: "POST", headers: { authorization: "Bearer fixture-automation", "content-type": "application/json" }, body: JSON.stringify({ ...automationResult, ...extra }),
    });
    assert.equal(rejected.status, 400, "Automation cannot bypass a required answer with an unrecognized void flag");
  }
  assert.equal(JSON.stringify(resultTables), unchangedResultState, "Rejected void requests never modify results, picks, or totals");

  const normalResult = await submitResult({ ...adminResult, bonusAnswer: "Yes" });
  assert.equal(normalResult.status, 200);
  assert.equal((await normalResult.json()).published, true);
  assert.equal(resultTables.episode_results[0].bonus_answer, "Yes");
  assert.deepEqual(resultTables.picks.map(pick => [pick.bonus_point, pick.double_point]), [[1, 1], [-1, 0], [0, 0]]);
  assert.deepEqual(resultTables.profiles.map(profile => profile.total_points), [8, 5, 6]);
  const otherComponents = (tables: Record<string, Row[]>) => tables.picks.map(pick => [pick.favorite_point, pick.immunity_point, pick.boot_point, pick.underdog_point, pick.streak_point]);
  const normalComponents = otherComponents(resultTables);
  const assertVoidedResult = () => {
    assert.ok(resultTables);
    assert.equal(resultTables.episode_results[0].bonus_answer, "");
    assert.equal(resultTables.episodes[0].results_posted, true);
    assert.equal(resultTables.episodes[0].results_published, true);
    assert.deepEqual(resultTables.picks.map(pick => [pick.bonus_pick, pick.double_down, pick.bonus_point, pick.double_point]), [["Yes", "bonus", 0, 0], ["No", "bonus", 0, 0], ["", "", 0, 0]], "Voiding preserves submitted choices and awards no advantage or bonus-targeted Shot points");
    assert.deepEqual(otherComponents(resultTables), normalComponents, "Voiding does not alter favorite, immunity, vote-out, underdog, or streak points");
    assert.deepEqual(resultTables.profiles.map(profile => profile.total_points), [6, 6, 6], "Published totals include the zeroed question consistently");
    assert.equal(resultTables.episodes[0].bonus_question, episodes[0].bonus_question, "Voiding preserves the historical question");
  };
  resultTables = freshResultTables();
  const voided = await submitResult({ ...adminResult, voidBonusQuestion: "on" });
  assert.equal(voided.status, 200);
  assert.equal((await voided.json()).published, true);
  assertVoidedResult();
  const voidedSeason = await fetch(`${appUrl}/season`, { headers });
  assert.equal(voidedSeason.status, 200);
  assert.match(await voidedSeason.text(), /Question voided — no points awarded/);
  const alreadyPublished = JSON.stringify(resultTables);
  assert.equal((await submitResult({ ...adminResult, voidBonusQuestion: "on" })).status, 409, "A published episode cannot be silently rescored through results entry");
  assert.equal(JSON.stringify(resultTables), alreadyPublished);

  for (const failure of [{ table: "picks", id: "result-b" }, { table: "episode_results" }, { table: "episodes" }]) {
    resultTables = freshResultTables();
    resultWriteFailure = failure;
    const profilesBeforeFailure = JSON.stringify(resultTables.profiles);
    const failed = await submitResult({ ...adminResult, voidBonusQuestion: "on" });
    assert.equal(failed.status, 500, `Failed ${failure.table} write is not reported as a successful void`);
    assert.equal(resultTables.episodes[0].results_posted, false, "Incomplete result writes cannot be marked posted");
    assert.equal(resultTables.episodes[0].results_published, false, "Incomplete result writes cannot be revealed");
    assert.equal(JSON.stringify(resultTables.profiles), profilesBeforeFailure, "Failed scoring cannot update published profile totals");
    resultWriteFailure = null;
    assert.equal((await submitResult({ ...adminResult, voidBonusQuestion: "on" })).status, 200, "A commissioner can retry after a prepublication write failure");
    assertVoidedResult();
  }
  resultTables = null;
  console.log("Season and weekly-pick smoke passed: auth, current home status, scores, member breakdowns, private selections, spoilers, negative totals, revealed cast markers, disabled Favorite card data, eliminated-pick rejection, required Vote-Out, optional advantage save/skip, fresh carryover, unique names, default question, frozen saved questions, commissioner-only explicit voids, strict automation answers, and failed result writes staying unpublished.");
  if (serve) {
    // Keep one real fixture departure visible for browser review without changing ordinary smoke cases.
    serveDepartedCard = true;
    for (const pick of playPicks.filter(pick => pick.episode_id === 5)) pick.boot_pick = castIds.other;
    console.log(`Visual review: ${fixtureUrl}/sign-in`);
    await new Promise(() => {});
  }
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  close();
}
