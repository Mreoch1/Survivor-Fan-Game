import assert from "node:assert/strict";
import test from "node:test";
import { buildReminderEmail, getMissingRequiredPicks, getPickReceipts } from "../lib/reminder-email";

const emptyPick = { favorite_id: "", immunity_pick: "", boot_pick: "", bonus_pick: "", double_down: "" };
const profile = { individual_game_pick: null, endgame_pick: null };

test("only required empty picks trigger a reminder", () => {
  assert.deepEqual(
    getMissingRequiredPicks({ episodeId: 1, pick: emptyPick, profile, finalTorchDecisionOpen: false }),
    ["Weekly Favorite Pick", "Immunity Pick", "Opening Outlast Pick"],
  );
  assert.deepEqual(
    getMissingRequiredPicks({
      episodeId: 2,
      pick: { ...emptyPick, favorite_id: "ana", immunity_pick: "Savu" },
      profile,
      finalTorchDecisionOpen: false,
    }),
    [],
  );
});

test("the one-time Final Torch decision is required only while its window is open", () => {
  const weekly = { ...emptyPick, favorite_id: "ana", immunity_pick: "ana" };
  assert.deepEqual(
    getMissingRequiredPicks({ episodeId: 8, pick: weekly, profile, finalTorchDecisionOpen: true }),
    ["Final Torch Pick"],
  );
  assert.deepEqual(
    getMissingRequiredPicks({ episodeId: 8, pick: weekly, profile, finalTorchDecisionOpen: false }),
    [],
  );
});

test("pick receipts clearly label the prediction and the saved choice", () => {
  const receipts = getPickReceipts({
    episodeId: 2,
    phase: "tribe",
    pick: { favorite_id: "ana", immunity_pick: "Savu", boot_pick: "brady", bonus_pick: "Yes", double_down: "boot" },
    profile,
    finalTorchDecisionOpen: false,
    castawayName: (id) => ({ ana: "Ana Sani", brady: "Brady Booker" })[id || ""] || null,
  });
  assert.deepEqual(receipts, [
    { label: "Weekly Favorite Pick", selection: "Ana Sani", required: true },
    { label: "Immunity Pick", selection: "Savu Tribe", required: true },
    { label: "Vote-Out Pick", selection: "Brady Booker", required: false },
    { label: "Wild Card Pick", selection: "Yes", required: false },
    { label: "Shot in the Dark", selection: "Vote-Out Pick · Brady Booker", required: false },
  ]);
});

test("the branded email is action-focused, spoiler-free, and escapes player text", () => {
  const email = buildReminderEmail({
    playerName: "Mike <Torch>",
    teamName: "Blindside & Co.",
    episodeId: 3,
    episodeTitle: "A Test Episode",
    lockAt: "2026-10-07T23:00:00.000Z",
    leagueUrl: "https://survivor-fan-game.vercel.app/play",
    missingPicks: ["Immunity Pick"],
    receipts: [{ label: "Immunity Pick", selection: "No pick yet", required: true }],
    snapshot: {
      playerRank: 2,
      playerPoints: 7,
      leaderName: "Camp Chaos",
      leaderPoints: 9,
      latestEpisodeId: 2,
      latestHighScorerNames: ["Torch Crew"],
      latestHighScore: 6,
    },
  });
  assert.match(email.subject, /voting booth closes tomorrow/);
  assert.match(email.plainText, /Immunity Pick: No pick yet/);
  assert.match(email.plainText, /This is a spoiler-free league update/);
  assert.match(email.html, /Blindside &amp; Co\./);
  assert.doesNotMatch(email.html, /Mike <Torch>/);
  assert.match(email.html, /Enter the voting booth/);
});
