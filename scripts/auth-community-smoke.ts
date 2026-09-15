// All accounts, messages, tokens, and writes are isolated in-memory fixtures.
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { REMEMBER_MAX_AGE } from "../lib/supabase/session-cookies";
import { publishedUpdates } from "../lib/league-updates";

const appUrl = "http://127.0.0.1:3108";
const fixtureUrl = "http://127.0.0.1:4357";
const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
const c = "33333333-3333-4333-8333-333333333333";
type Row = Record<string, unknown>;
const profiles: Row[] = [a, b, c].map((id, index) => ({ id, display_name: ["Alex", "Blair", "Casey"][index], team_name: ["Camp Alpha", "Camp Bravo", "Camp Charlie"][index], avatar_key: "torch", league_joined_at: "2026-09-01T00:00:00Z", campfire_read_at: null }));
const posts: Row[] = [
  { id: 1, user_id: b, body: "Welcome to the Campfire!", parent_post_id: null, created_at: "2026-09-01T10:00:00Z" },
  { id: 2, user_id: a, body: "My own idea", parent_post_id: null, created_at: "2026-09-01T11:00:00Z" },
  { id: 3, user_id: c, body: "A new reply", parent_post_id: 1, created_at: "2026-09-01T12:00:00Z" },
];
const messages: Row[] = [
  { id: 1, sender_id: b, recipient_id: a, body: "Hello Alex", read_at: null, created_at: "2026-09-01T10:00:00Z" },
  { id: 2, sender_id: c, recipient_id: a, body: "Another conversation", read_at: null, created_at: "2026-09-01T11:00:00Z" },
  { id: 3, sender_id: a, recipient_id: b, body: "Outgoing", read_at: null, created_at: "2026-09-01T12:00:00Z" },
];
const signingKey = randomBytes(32);
const acknowledgements: Row[] = [];
let acknowledgementFailure = false;
let usedRefresh = false;
let logoutScope = "";
function session(expired = false, userId = a) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const exp = expired ? 1700000000 : Math.floor(Date.now() / 1000) + 3600;
  const email = userId === a ? "alex@example.test" : "blair@example.test";
  const value = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: userId, email, aud: "authenticated", role: "authenticated", exp, iat: exp - 3600 })}`;
  return { access_token: `${value}.${createHmac("sha256", signingKey).update(value).digest("base64url")}`, refresh_token: expired ? "expired-fixture" : "fresh-fixture", expires_at: exp, expires_in: 3600, token_type: "bearer", user: { id: userId, email } };
}
const cookie = (expired = false, userId = a) => `sb-127-auth-token=base64-${Buffer.from(JSON.stringify(session(expired, userId))).toString("base64url")}`;
function split(value: string) {
  let depth = 0;
  let start = 0;
  const result: string[] = [];
  for (let i = 0; i < value.length; i++) {
    if (value[i] === "(") depth++;
    if (value[i] === ")") depth--;
    if (value[i] === "," && depth === 0) { result.push(value.slice(start, i)); start = i + 1; }
  }
  return [...result, value.slice(start)];
}
function matches(row: Row, field: string, filter: string): boolean {
  if (field === "or" || field === "and") {
    const parts = split(filter.slice(1, -1)).map(part => { const group = /^(and|or)(\(.*\))$/.exec(part); if (group) return matches(row, group[1], group[2]); const dot = part.indexOf("."); return matches(row, part.slice(0, dot), part.slice(dot + 1)); });
    return field === "or" ? parts.some(Boolean) : parts.every(Boolean);
  }
  if (filter === "not.is.null") return row[field] != null;
  if (filter === "is.null") return row[field] == null;
  const value = String(row[field]);
  if (filter.startsWith("eq.")) return value === filter.slice(3);
  if (filter.startsWith("neq.")) return value !== filter.slice(4);
  if (filter.startsWith("gt.")) return value > filter.slice(3);
  if (filter.startsWith("lt.")) return value < filter.slice(3);
  if (filter.startsWith("lte.")) return value <= filter.slice(4);
  if (filter.startsWith("in.(")) return filter.slice(4, -1).split(",").includes(value);
  throw new Error(`Unexpected fixture filter ${field}=${filter}`);
}
const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", fixtureUrl);
  response.setHeader("content-type", "application/json");
  response.setHeader("access-control-allow-origin", appUrl);
  response.setHeader("access-control-allow-headers", "authorization,apikey,content-type,x-client-info,x-supabase-api-version");
  response.setHeader("access-control-allow-methods", "GET,POST,PUT,OPTIONS");
  if (request.method === "OPTIONS") return response.end();
  let raw = "";
  for await (const chunk of request) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};
  if (url.pathname === "/auth/v1/token") {
    if (body.refresh_token === "expired-fixture") {
      if (usedRefresh) { response.statusCode = 400; return response.end(JSON.stringify({ error_code: "refresh_token_already_used", msg: "Already used" })); }
      usedRefresh = true;
    }
    return response.end(JSON.stringify(session()));
  }
  if (url.pathname === "/auth/v1/user") {
    const token = request.headers.authorization?.replace(/^Bearer /, "") || "";
    const [header, payload, signature] = token.split(".");
    if (createHmac("sha256", signingKey).update(`${header}.${payload}`).digest("base64url") !== signature) {
      response.statusCode = 401; return response.end(JSON.stringify({ error: "Invalid fixture token" }));
    }
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    return response.end(JSON.stringify(session(false, claims.sub).user));
  }
  if (url.pathname === "/auth/v1/logout") { logoutScope = url.searchParams.get("scope") || ""; return response.end("{}"); }
  if (url.pathname === "/sign-in") { response.writeHead(302, { "set-cookie": `${cookie(false, url.searchParams.get("player") === "b" ? b : a)}; Path=/; SameSite=Lax`, location: `${appUrl}/rules` }); return response.end(); }
  if (!url.pathname.startsWith("/rest/v1/")) { response.statusCode = 404; return response.end("{}"); }
  const table = url.pathname.split("/").at(-1)!;
  if (table === "league_update_acknowledgements") {
    assert.equal(request.headers.apikey, "fixture-service", "Receipts use the server credential");
    if (acknowledgementFailure) { response.statusCode = 503; return response.end(JSON.stringify({ message: "Fixture unavailable" })); }
    if (request.method === "POST") {
      assert.match(String(request.headers.prefer || ""), /resolution=ignore-duplicates/);
      for (const row of body as Row[]) {
        if (!acknowledgements.some(existing => existing.user_id === row.user_id && existing.update_id === row.update_id)) {
          acknowledgements.push({ ...row, acknowledged_at: new Date().toISOString() });
        }
      }
      response.statusCode = 201; return response.end();
    }
  }
  let rows = ({ profiles, posts, private_messages: messages, league_update_acknowledgements: acknowledgements } as Record<string, Row[]>)[table] || [];
  for (const [field, filter] of url.searchParams) {
    if (!["select", "order", "limit", "offset"].includes(field)) rows = rows.filter(row => matches(row, field, filter));
  }
  if (request.method === "PATCH") rows.forEach(row => Object.assign(row, body));
  else if (!["GET", "HEAD"].includes(request.method || "")) { response.statusCode = 405; return response.end("{}"); }
  const order = url.searchParams.get("order")?.split(".");
  if (order) rows = [...rows].sort((x, y) => String(x[order[0]]).localeCompare(String(y[order[0]])) * (order[1] === "desc" ? -1 : 1));
  response.setHeader("content-range", `0-${Math.max(rows.length - 1, 0)}/${rows.length}`);
  rows = rows.slice(0, Number(url.searchParams.get("limit") || 1000));
  if (request.method === "HEAD") return response.end();
  response.end(JSON.stringify(request.headers.accept?.includes("vnd.pgrst.object+json") ? rows[0] || null : rows));
});
server.listen(4357, "127.0.0.1");
await once(server, "listening");
const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3108"], {
  env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: fixtureUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture-anon", SUPABASE_SERVICE_ROLE_KEY: "fixture-service", COMMISSIONER_EMAILS: "alex@example.test" }, stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
app.stdout.on("data", value => { logs += value; });
app.stderr.on("data", value => { logs += value; });
const close = () => { app.kill(); server.close(); };
process.on("SIGTERM", () => { close(); process.exit(0); });
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${appUrl}/login`)).ok) { ready = true; break; } } catch { /* Startup. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready);
  const headers = { cookie: cookie(), "content-type": "application/json" };
  const counts = async () => (await fetch(`${appUrl}/api/notifications`, { headers })).json();
  assert.equal((await fetch(`${appUrl}/api/notifications`)).status, 403);
  assert.deepEqual(await counts(), { campfire: 2, messages: 2 });
  const response = await fetch(`${appUrl}/api/notifications`, { headers });
  assert.match(response.headers.get("cache-control") || "", /no-store/);
  const readCampfire = (readThrough: string) => fetch(`${appUrl}/api/notifications`, { method: "PUT", headers, body: JSON.stringify({ readThrough }) });
  assert.equal((await readCampfire("2999-01-01T00:00:00Z")).status, 400);
  assert.equal((await readCampfire("2026-09-01T10:30:00Z")).status, 200);
  assert.deepEqual(await counts(), { campfire: 1, messages: 2 });
  await readCampfire("2026-09-01T09:00:00Z");
  assert.equal((await counts()).campfire, 1, "A stale tab cannot undo newer read status");
  const loaded = await (await fetch(`${appUrl}/api/posts`, { headers })).json();
  assert.equal(loaded.threads.length, 2);
  await readCampfire(loaded.readThrough);
  assert.equal((await counts()).campfire, 0);
  posts.push({ id: 4, user_id: b, body: "Arrived after the read snapshot", parent_post_id: 1, created_at: new Date(Date.parse(loaded.readThrough) + 1).toISOString() });
  assert.equal((await counts()).campfire, 1, "New replies remain unread");
  const conversation = await (await fetch(`${appUrl}/api/messages?with=${b}`, { headers })).json();
  assert.deepEqual(conversation.messages.map((message: { id: number }) => message.id), [1, 3], "Conversation contains only this pair of players");
  const cutoff = conversation.readThrough;
  messages.push({ id: 4, sender_id: b, recipient_id: a, body: "Arrived during loading", read_at: null, created_at: new Date(Date.parse(cutoff) + 1).toISOString() });
  const read = await fetch(`${appUrl}/api/messages`, { method: "PUT", headers, body: JSON.stringify({ withUserId: b, readThrough: cutoff }) });
  assert.equal(read.status, 200);
  assert.equal((await counts()).messages, 2, "Other senders, outgoing messages, and later arrivals remain unread");
  assert.equal(messages[1].read_at, null);
  assert.equal(messages[2].read_at, null);
  const oldHistory = Array.from({ length: 1100 }, (_, i) => ({ id: i + 10, sender_id: b, recipient_id: a, body: "Older conversation history", read_at: null, created_at: "2026-09-01T09:00:00Z" }));
  messages.push(...oldHistory);
  const longConversation = await (await fetch(`${appUrl}/api/messages?with=${b}`, { headers })).json();
  assert.equal(longConversation.messages.length, 500);
  const clearHistory = await fetch(`${appUrl}/api/messages`, { method: "PUT", headers, body: JSON.stringify({ withUserId: b, readThrough: longConversation.readThrough }) });
  assert.equal(clearHistory.status, 200);
  assert.ok(oldHistory.every(message => message.read_at !== null), "Unread history outside both display limits can clear");
  assert.equal((await counts()).messages, 1, "The other conversation stays unread");
  messages.splice(4);
  for (const remembered of [true, false]) {
    usedRefresh = false;
    const refreshed = await fetch(`${appUrl}/rules`, { headers: { cookie: `${cookie(true)}; outlast-remember=${remembered}` } });
    assert.equal(refreshed.status, 200);
    assert.ok(usedRefresh, "Expired access tokens refresh");
    assert.match(await refreshed.text(), /Sign out/);
    const setCookie = refreshed.headers.getSetCookie().find(value => value.startsWith("sb-127-auth-token=")) || "";
    assert.ok(setCookie);
    if (remembered) assert.match(setCookie, new RegExp(`Max-Age=${REMEMBER_MAX_AGE}`, "i"));
    else assert.doesNotMatch(setCookie, /Max-Age|Expires/i);
    assert.match(refreshed.headers.get("cache-control") || "", /no-store/);
  }
  const login = await fetch(`${appUrl}/login?returnTo=%2Fmessages`, { headers, redirect: "manual" });
  assert.equal(login.headers.get("location"), "/messages");
  const logout = await fetch(`${appUrl}/api/auth/signout`, { headers, redirect: "manual" });
  assert.equal(logoutScope, "local");
  assert.ok(logout.headers.getSetCookie().some(value => /sb-127-auth-token=;/.test(value) && /Max-Age=0/i.test(value)));
  const updateIds = publishedUpdates().map(update => update.id);
  assert.ok(updateIds.length);
  const otherHeaders = { ...headers, cookie: cookie(false, b) };
  const acknowledge = (body: unknown, requestHeaders = headers) => fetch(`${appUrl}/api/updates`, { method: "POST", headers: requestHeaders, body: JSON.stringify(body) });
  assert.equal((await fetch(`${appUrl}/api/updates`)).status, 401);
  assert.equal((await fetch(`${appUrl}/api/updates`, { method: "POST" })).status, 401);
  const pending = await fetch(`${appUrl}/api/updates`, { headers });
  assert.match(pending.headers.get("cache-control") || "", /private, no-store/);
  assert.deepEqual((await pending.json()).updates.map((update: { id: string }) => update.id), updateIds);
  for (const updateIds of [[], ["unknown"], [null]]) assert.equal((await acknowledge({ updateIds })).status, 400);
  assert.equal((await acknowledge({ updateIds }, { ...headers, "sec-fetch-site": "cross-site" } as typeof headers)).status, 403);
  assert.equal((await acknowledge({ updateIds }, { ...headers, "content-type": "text/plain" })).status, 403);
  assert.equal(acknowledgements.length, 0);
  assert.equal((await acknowledge({ updateIds, user_id: b, acknowledged_at: "2999-01-01" })).status, 200);
  assert.ok(acknowledgements.every(row => row.user_id === a && row.acknowledged_at !== "2999-01-01"), "Client cannot acknowledge for someone else or choose a timestamp");
  const firstReceipts = structuredClone(acknowledgements);
  const retries = await Promise.all([acknowledge({ updateIds }), acknowledge({ updateIds })]);
  assert.ok(retries.every(result => result.ok));
  assert.deepEqual(acknowledgements, firstReceipts, "Concurrent retries preserve the first receipt");
  assert.deepEqual((await (await fetch(`${appUrl}/api/updates`, { headers: { cookie: cookie() } })).json()).updates, [], "A fresh session for the same account remembers confirmation");
  assert.equal((await (await fetch(`${appUrl}/api/updates`, { headers: otherHeaders })).json()).updates.length, updateIds.length, "Other accounts still have their own unread notices");
  assert.match(await (await fetch(`${appUrl}/updates`, { headers })).text(), /Welcome to our first season/);
  assert.deepEqual(acknowledgements, firstReceipts, "Reading update history does not write a receipt");
  const commissioner = await (await fetch(`${appUrl}/commissioner`, { headers })).text();
  assert.match(commissioner, /Who has confirmed the latest update/);
  assert.match(commissioner, /Not confirmed yet/);
  assert.doesNotMatch(await (await fetch(`${appUrl}/commissioner`, { headers: otherHeaders })).text(), /Who has confirmed the latest update/);
  acknowledgementFailure = true;
  assert.equal((await fetch(`${appUrl}/api/updates`, { headers })).status, 503);
  assert.equal((await acknowledge({ updateIds }, otherHeaders)).status, 503);
  assert.deepEqual(acknowledgements, firstReceipts, "An outage cannot mark a notice confirmed");
  acknowledgementFailure = false;
  assert.equal((await acknowledge({ updateIds }, otherHeaders)).status, 200, "Confirmation can retry after recovery");
  console.log("Auth/community smoke passed: session refresh, both persistence modes, local sign-out, exact unread counts, access control, read races, and monotonic Campfire cursors.");
  console.log("Update smoke passed: verified account isolation, persistent and idempotent receipts, invalid submissions, commissioner-only tracking, history, and outage recovery.");
  if (process.argv.includes("--serve")) {
    acknowledgements.length = 0;
    profiles[0].campfire_read_at = null;
    messages.forEach(message => { message.read_at = null; });
    console.log(`Visual fixture: ${appUrl}/login (alex@example.test / any fixture password)`);
    await new Promise(() => {});
  }
} catch (error) { console.error(logs); throw error; }
finally { close(); }
