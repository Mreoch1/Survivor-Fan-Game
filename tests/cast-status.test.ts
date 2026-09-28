import assert from "node:assert/strict";
import test from "node:test";
import { buildCastDepartures, type CastStatusEpisode, type CastStatusResult } from "../lib/cast-status";

const now = new Date("2026-09-24T13:00:00Z");
const episode: CastStatusEpisode = { id: 1, reveal_at: now.toISOString(), results_published: true };
const result: CastStatusResult = { episode_id: 1, departures: [{ castawayId: "voted", type: "vote" }, { castawayId: "medical", type: "medical" }, { castawayId: "quit", type: "quit" }] };
const input = () => ({ episodes: [episode], results: [result], now, castawayIds: ["voted", "medical", "quit", "active"] });

test("only revealed departures mark cards; votes and other exits retain accurate labels", () => {
  const statuses = buildCastDepartures(input());
  assert.deepEqual(statuses.get("voted"), { episodeId: 1, type: "vote", label: "Voted out" });
  assert.equal(statuses.get("medical")?.label, "Left the game");
  assert.equal(statuses.get("quit")?.label, "Left the game");
  assert.equal(statuses.has("active"), false);
});

test("the exact reveal boundary is respected even when publication happened early", () => {
  assert.equal(buildCastDepartures({ ...input(), now: new Date(now.getTime() - 1) }).size, 0);
  assert.equal(buildCastDepartures(input()).size, 3);
  assert.equal(buildCastDepartures({ ...input(), episodes: [{ ...episode, results_published: false }] }).size, 0);
  assert.equal(buildCastDepartures({ ...input(), episodes: [{ ...episode, reveal_at: "invalid" }] }).size, 0);
});

test("future and unpublished result data cannot expose departures or affect revealed cards", () => {
  const statuses = buildCastDepartures({ ...input(), episodes: [episode, { ...episode, id: 2, results_published: false }, { ...episode, id: 3, reveal_at: "2999-01-01T13:00:00Z" }], results: [result, { episode_id: 2, departures: [{ castawayId: "active", type: "vote" }] }, { episode_id: 3, departures: [{ castawayId: "SECRET_FUTURE_DEPARTURE", type: "vote" }] }] });
  assert.equal(statuses.has("active"), false);
  assert.doesNotMatch(JSON.stringify([...statuses]), /SECRET_FUTURE_DEPARTURE/);
});

test("missing or malformed published results fail instead of suggesting everyone is active", () => {
  assert.throws(() => buildCastDepartures({ ...input(), results: [] }), /unavailable/);
  for (const departures of [null, {}, [null], [{ castawayId: "unknown", type: "vote" }], [{ castawayId: "active", type: "unknown" }]]) {
    assert.throws(() => buildCastDepartures({ ...input(), results: [{ ...result, departures }] }), /unavailable|invalid/);
  }
});

test("an empty season and a revealed episode with no departures have no red-X statuses", () => {
  assert.equal(buildCastDepartures({ ...input(), episodes: [], results: [] }).size, 0);
  assert.equal(buildCastDepartures({ ...input(), results: [{ ...result, departures: [] }] }).size, 0);
});
