import assert from "node:assert/strict";
import test from "node:test";
import { serializeCookieHeader } from "@supabase/ssr";
import { REMEMBER_MAX_AGE, sessionCookieOptions } from "../lib/supabase/session-cookies";
import { validReadThrough } from "../lib/notifications";

test("remembered sessions survive browser close while unchecked sessions have no expiry", () => {
  const defaults = { maxAge: 400 * 86400, expires: new Date("2030-01-01"), secure: true };
  const remembered = serializeCookieHeader("session", "token", sessionCookieOptions(defaults, true));
  assert.match(remembered, new RegExp(`Max-Age=${REMEMBER_MAX_AGE}`));
  assert.match(remembered, /Secure/);
  const session = serializeCookieHeader("session", "token", sessionCookieOptions(defaults, false));
  assert.doesNotMatch(session, /Max-Age|Expires/i);
  assert.match(session, /SameSite=Lax/);
  assert.equal(defaults.maxAge, 400 * 86400);
});

test("sign-out and superseded cookie chunks still expire for either preference", () => {
  for (const remembered of [true, false]) {
    assert.match(serializeCookieHeader("session.1", "", sessionCookieOptions({ maxAge: 0 }, remembered)), /Max-Age=0/);
  }
});

test("Campfire read cursors reject invalid or future timestamps", () => {
  const now = Date.parse("2026-09-10T15:00:00Z");
  assert.ok(validReadThrough("2026-09-10T14:59:00Z", now));
  for (const value of [null, 1, "bad", "1970-01-01", "2026-09-10T15:00:01Z"]) assert.equal(validReadThrough(value, now), false);
});
