import assert from "node:assert/strict";
import test from "node:test";
import { schedulePopupQuestionRefresh } from "../lib/popup-question-refresh";

const start = Date.parse("2026-10-07T16:00:00Z");

test("a page left visible discovers a scheduled question at its opening without focus or reload", async t => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: start });
  let loads = 0;
  const stop = schedulePopupQuestionRefresh(new Date(start + 60_000).toISOString(), Date.now, async () => { loads++; return true; });
  t.after(stop);
  t.mock.timers.tick(59_999);
  assert.equal(loads, 0);
  t.mock.timers.tick(1);
  assert.equal(loads, 1);
  await Promise.resolve();
  t.mock.timers.tick(60_000);
  assert.equal(loads, 1, "A successful refresh does not create repeated requests");
});

test("scheduled refresh follows server time rather than a fast local device clock", t => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: start + 3_600_000 });
  let loads = 0;
  const stop = schedulePopupQuestionRefresh(new Date(start + 60_000).toISOString(), () => Date.now() - 3_600_000, async () => { loads++; return true; });
  t.after(stop);
  t.mock.timers.tick(59_999);
  assert.equal(loads, 0);
  t.mock.timers.tick(1);
  assert.equal(loads, 1);
});

test("a blocked or failed boundary refresh retries instead of losing the question", async t => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: start });
  let loads = 0;
  const stop = schedulePopupQuestionRefresh(new Date(start + 1000).toISOString(), Date.now, async () => {
    loads++;
    if (loads === 1) return false; // A vote in flight or hidden tab delayed the read.
    if (loads === 2) throw new Error("Temporary connection failure");
    return true;
  });
  t.after(stop);
  t.mock.timers.tick(1000);
  await Promise.resolve();
  assert.equal(loads, 1);
  t.mock.timers.tick(30_000);
  await Promise.resolve();
  assert.equal(loads, 2);
  t.mock.timers.tick(30_000);
  await Promise.resolve();
  assert.equal(loads, 3);
});

test("unmount or auth loss cancels the pending refresh, including an in-flight retry", async t => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: start });
  let loads = 0;
  const stop = schedulePopupQuestionRefresh(new Date(start + 1000).toISOString(), Date.now, async () => { loads++; return false; });
  t.mock.timers.tick(1000);
  stop();
  await Promise.resolve();
  t.mock.timers.tick(60_000);
  assert.equal(loads, 1);
  for (const value of [null, "invalid"]) schedulePopupQuestionRefresh(value, Date.now, async () => { loads++; return true; });
  t.mock.timers.tick(60_000);
  assert.equal(loads, 1);
});

test("distant opening timestamps do not overflow the browser timer into immediate polling", t => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: start });
  let loads = 0;
  const delay = 2_147_483_647 + 10_000;
  const stop = schedulePopupQuestionRefresh(new Date(start + delay).toISOString(), Date.now, async () => { loads++; return true; });
  t.after(stop);
  t.mock.timers.tick(2_147_483_647);
  assert.equal(loads, 0);
  t.mock.timers.tick(10_000);
  assert.equal(loads, 1);
});
