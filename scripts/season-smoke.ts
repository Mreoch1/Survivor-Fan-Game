// Isolated HTTP fixtures exercise the compiled app's real auth and data-loading path.
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
const profiles = fixture.profiles.map(profile => ({ ...replaceIds(profile) as typeof profile, league_joined_at: "2025-09-01T00:00:00Z", created_at: "2025-09-01T00:00:00Z" }));
const episodes = fixture.episodes.map(episode => ({ ...episode, lock_at: episode.lock_at.replace("2026", "2025"), reveal_at: episode.reveal_at.replace("2026", "2025"), results_posted: true }));
const picks = (replaceIds(fixture.picks) as typeof fixture.picks).map(pick => ({ ...pick, immunity_pick: pick.episode_id > 2 ? castaways[3].id : pick.immunity_pick }));
const results = replaceIds(fixture.results) as typeof fixture.results;
const hidden = { ...episodes[0], id: 99, title: "HIDDEN_FUTURE_EPISODE", individual_game_started: true, results_published: false, reveal_at: "2999-01-01T13:00:00Z" };
let emptySeason = false;
const queries: string[] = [];

const fixtureSigningKey = randomBytes(32);
function sessionFor(id: string) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const payload = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: id, email: `${id}@example.test`, aud: "authenticated", role: "authenticated", exp: 4102444800, iat: 1700000000 })}`;
  const token = `${payload}.${createHmac("sha256", fixtureSigningKey).update(payload).digest("base64url")}`;
  return { access_token: token, refresh_token: "local-smoke-refresh", expires_at: 4102444800, expires_in: 3600, token_type: "bearer", user: { id, email: `${id}@example.test` } };
}
const cookieFor = (id: string) => `sb-127-auth-token=base64-${Buffer.from(JSON.stringify(sessionFor(id))).toString("base64url")}`;

const server = createServer((request, response) => {
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
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.statusCode = 405;
    return response.end(JSON.stringify({ message: "Smoke database is read-only" }));
  }
  queries.push(url.pathname + url.search);
  const tables: Record<string, unknown[]> = { profiles, episodes: emptySeason ? [] : [...episodes, hidden], picks: [...picks, { ...picks[0], episode_id: 99, favorite_id: "SECRET_FUTURE_PICK", favorite_point: 99 }], episode_results: [...results, { ...results[0], episode_id: 99, finale_winner: "SECRET_FUTURE_WINNER" }], private_messages: [] };
  let rows = (tables[url.pathname.split("/").at(-1)!] || []) as Record<string, unknown>[];
  for (const [field, filter] of url.searchParams) {
    if (["select", "order", "limit", "offset"].includes(field)) continue;
    const compare = (row: Record<string, unknown>) => {
      const value = String(row[field]);
      if (filter === "not.is.null") return row[field] != null;
      if (filter === "is.null") return row[field] == null;
      if (filter.startsWith("eq.")) return value === filter.slice(3);
      if (filter.startsWith("lte.")) return value <= filter.slice(4);
      if (filter.startsWith("in.(")) return filter.slice(4, -1).split(",").includes(value);
      throw new Error(`Unsupported smoke filter: ${filter}`);
    };
    rows = rows.filter(compare);
  }
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
  env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: fixtureUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture-anon", SUPABASE_SERVICE_ROLE_KEY: "fixture-service", NEXT_PUBLIC_SITE_URL: appUrl },
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
  assert.match(html, /Post-merge championship/);
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
  console.log("Season smoke passed: anonymous redirect, membership gate, published scores, half points, spoiler filtering, Campfire highlights, and empty season.");
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
