import assert from "node:assert/strict";
import test from "node:test";
import { getMergeWelcomeCopy } from "../lib/merge-welcome";

test("a surviving Opening Outlast Pick can earn the full Final Torch award", () => {
  const copy = getMergeWelcomeCopy({ originalName: "Ana", originalIsActive: true, individualGamePoints: 10 });
  assert.match(copy.openingResult, /Ana reached the individual game/);
  assert.match(copy.openingResult, /earned 10 Opening Outlast points and keep them/);
  assert.match(copy.finalTorchAdvice, /Keep Ana for 10 more points if they win or 3 if they finish second or third/);
  assert.match(copy.finalTorchAdvice, /switch.*5 points for winning or 1\.5 for second or third/);
});

test("a pick who reached the announcement and then departed keeps the merge award", () => {
  const copy = getMergeWelcomeCopy({ originalName: "Brady", originalIsActive: false, individualGamePoints: 10 });
  assert.match(copy.openingResult, /Brady reached the individual game before leaving/);
  assert.match(copy.openingResult, /earned 10 Opening Outlast points and keep them/);
  assert.match(copy.finalTorchAdvice, /Choose a remaining castaway/);
  assert.match(copy.finalTorchAdvice, /5 points if they win or 1\.5 if they finish second or third/);
  assert.doesNotMatch(copy.finalTorchAdvice, /Keep Brady/);
});

test("a pick who left earlier earns zero and can be replaced for the reduced award", () => {
  const copy = getMergeWelcomeCopy({ originalName: "Ori", originalIsActive: false, individualGamePoints: 0 });
  assert.match(copy.openingResult, /Ori left before the individual game.*earned 0 points/);
  assert.match(copy.finalTorchAdvice, /Choose a remaining castaway/);
  assert.match(copy.finalTorchAdvice, /5 points if they win or 1\.5/);
});

test("a player with no named opening pick sees their score and can still choose a Final Torch", () => {
  const copy = getMergeWelcomeCopy({ originalName: null, originalIsActive: false, individualGamePoints: 0 });
  assert.equal(copy.openingResult, "Your Opening Outlast score is 0 points.");
  assert.match(copy.finalTorchAdvice, /Choose a remaining castaway/);
  assert.match(copy.finalTorchAdvice, /5 points if they win or 1\.5/);
});
