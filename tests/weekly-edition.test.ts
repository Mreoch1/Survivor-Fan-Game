import assert from "node:assert/strict";
import test from "node:test";
import { mondayMailWindow, selectWeeklyEdition, type MailEpisode } from "../lib/weekly-edition";

const episode: MailEpisode = { id: 1, air_at: "2026-09-24T00:00:00Z", reveal_at: "2026-09-24T13:00:00Z", results_published: true };

test("Wednesday episode stays eligible for Monday; Friday cannot mail", () => {
  const edition = selectWeeklyEdition([episode], new Date("2026-09-28T14:00:00Z"));
  assert.equal(edition.pending, true);
  if (edition.pending) assert.deepEqual(edition.episodeIds, [1]);
  assert.equal(selectWeeklyEdition([episode], new Date("2026-09-25T18:00:00Z")).pending, false);
  assert.equal(selectWeeklyEdition([episode], new Date("2026-09-28T13:59:59Z")).pending, false);
});

test("Monday gate follows Detroit daylight saving time", () => {
  assert.equal(mondayMailWindow(new Date("2026-11-02T14:59:59Z")).open, false);
  assert.equal(mondayMailWindow(new Date("2026-11-02T15:00:00Z")).open, true);
  assert.equal(mondayMailWindow(new Date("2026-11-03T02:00:00Z")).open, true);
  assert.equal(mondayMailWindow(new Date("2026-11-03T05:00:00Z")).open, false);
});

test("preseason and off weeks are distinct, with no stale recap", () => {
  const preseason = selectWeeklyEdition([{ ...episode, results_published: false }], new Date("2026-09-21T14:00:00Z"));
  assert.equal(preseason.pending && preseason.kind, "preseason");
  assert.equal(selectWeeklyEdition([episode], new Date("2026-10-05T14:00:00Z")).pending, false);
});

test("all episodes in a double week must be revealed and published", () => {
  const second = { ...episode, id: 2, results_published: false };
  const blocked = selectWeeklyEdition([episode, second], new Date("2026-09-28T14:00:00Z"));
  assert.equal(blocked.pending, false);
  assert.equal("needsAttention" in blocked && blocked.needsAttention, true);
  const ready = selectWeeklyEdition([episode, { ...second, results_published: true }], new Date("2026-09-28T14:00:00Z"));
  if (!ready.pending) assert.fail("Expected weekly edition");
  assert.deepEqual(ready.episodeIds, [1, 2]);
  const hidden = selectWeeklyEdition([{ ...episode, reveal_at: "2026-09-29T13:00:00Z" }], new Date("2026-09-28T14:00:00Z"));
  assert.equal(hidden.pending, false);
});
