import assert from "node:assert/strict";
import test from "node:test";
import { safeAuthReturnPath } from "../lib/auth-return-path";

test("sign-in redirects stay on the league even after URL normalization", () => {
  for (const value of [null, "", "https://example.org", "//example.org", "/\\example.org", "/\t/example.org", "/\n/example.org", "/\r/example.org", "/%2e%2e//example.org", "/.//example.org", "/play/..//example.org"]) {
    assert.equal(safeAuthReturnPath(value), "/play");
    assert.equal(new URL(safeAuthReturnPath(value), "https://league.test").origin, "https://league.test");
  }
});

test("normal league destinations and password recovery still work", () => {
  assert.equal(safeAuthReturnPath("/reset-password"), "/reset-password");
  assert.equal(safeAuthReturnPath("/season?episode=2#score-history"), "/season?episode=2#score-history");
  assert.equal(safeAuthReturnPath("/play"), "/play");
});
