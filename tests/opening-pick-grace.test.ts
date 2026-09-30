import assert from "node:assert/strict";
import test from "node:test";
import { getOpeningPickGrace } from "../db/opening-pick-grace";

const ids = ["26cc4460-c662-4aaa-84f4-9116c0afaba1", "26598461-d2d2-4ee8-9fef-194f0042d5d0"];
const episode = { id: 2, lock_at: "2026-09-30T23:00:00Z", results_posted: false };
const now = Date.parse("2026-09-30T17:00:00Z");

test("only the approved missing opening picks receive grace", () => {
  for (const id of ids) {
    assert.equal(getOpeningPickGrace(id, null, episode, now)?.closesAt, "2026-09-30T23:00:00.000Z");
    assert.equal(getOpeningPickGrace(id, "saved-castaway", episode, now), null);
    assert.equal(getOpeningPickGrace(id, "", episode, now), null);
  }
  assert.equal(getOpeningPickGrace("another-member", null, episode, now), null);
});

test("grace expires at the earlier episode deadline and cannot be extended by a schedule change", () => {
  assert.equal(getOpeningPickGrace(ids[0], null, episode, Date.parse(episode.lock_at)), null);
  assert.equal(getOpeningPickGrace(ids[0], null, { ...episode, lock_at: "2999-01-01T00:00:00Z" }, Date.parse("2026-10-01T00:00:00Z")), null);
  const earlier = { ...episode, lock_at: "2026-09-30T18:00:00Z" };
  assert.equal(getOpeningPickGrace(ids[0], null, earlier, now)?.closesAt, "2026-09-30T18:00:00.000Z");
  assert.equal(getOpeningPickGrace(ids[0], null, earlier, Date.parse(earlier.lock_at)), null);
});

test("missing, invalid, posted, and other-episode schedules fail closed", () => {
  for (const value of [null, { ...episode, id: 1 }, { ...episode, id: 3 }, { ...episode, results_posted: true }, { ...episode, lock_at: "invalid" }]) {
    assert.equal(getOpeningPickGrace(ids[0], null, value, now), null);
  }
});
