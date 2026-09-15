import assert from "node:assert/strict";
import test from "node:test";
import { leagueUpdates, pendingUpdates, publishedUpdates, validAcknowledgementIds } from "../lib/league-updates";

test("a future notice cannot be shown or acknowledged before publication", () => {
  const first = leagueUpdates[0];
  const before = Date.parse(first.publishedAt) - 1;
  assert.deepEqual(publishedUpdates(before), []);
  assert.deepEqual(pendingUpdates([], before), []);
  assert.equal(validAcknowledgementIds([first.id], before), false);
  assert.deepEqual(pendingUpdates([], before + 1).map(update => update.id), [first.id]);
});

test("only explicitly acknowledged notices disappear; unknown receipts do not hide new notices", () => {
  const now = Date.parse(leagueUpdates.at(-1)!.publishedAt);
  const allIds = publishedUpdates(now).map(update => update.id);
  assert.deepEqual(pendingUpdates(["retired-notice"], now).map(update => update.id), allIds);
  assert.deepEqual(pendingUpdates(allIds, now), []);
  assert.deepEqual(pendingUpdates(allIds.slice(0, -1), now).map(update => update.id), allIds.slice(-1));
});

test("confirmation requires distinct known published IDs", () => {
  const id = leagueUpdates[0].id;
  const now = Date.parse(leagueUpdates.at(-1)!.publishedAt);
  assert.equal(validAcknowledgementIds([id], now), true);
  for (const value of [null, {}, id, [], [id, id], ["unknown"], [id, "unknown"], [1], [null]]) {
    assert.equal(validAcknowledgementIds(value, now), false);
  }
});
