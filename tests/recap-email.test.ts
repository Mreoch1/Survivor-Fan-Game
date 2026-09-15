import assert from "node:assert/strict";
import test from "node:test";
import { buildPointBreakdown, buildResultsRecapEmail } from "../lib/recap-email";

const pick = {
  favorite_id: "ana",
  immunity_pick: "Savu",
  boot_pick: "brady",
  bonus_pick: "Yes",
  double_down: "boot",
  carried_from_episode_id: 1,
  favorite_point: 1,
  immunity_point: 2,
  boot_point: 3,
  bonus_point: 1,
  underdog_point: 1,
  streak_point: 2,
  double_point: 3,
};
const castawayName = (id: string | null | undefined) =>
  ({ ana: "Ana Sani", brady: "Brady Booker" })[id || ""] || null;

test("round breakdown includes every earned bonus and the carried-pick source", () => {
  const breakdown = buildPointBreakdown({
    pick,
    phase: "tribe",
    castawayName,
    individualGameStarted: false,
    individualGamePick: null,
    individualGamePoints: 0,
    finale: false,
    endgamePick: null,
    endgamePoints: 0,
  });
  assert.equal(breakdown.roundPoints, 13);
  assert.equal(breakdown.carriedFromEpisodeId, 1);
  assert.deepEqual(
    breakdown.rows.map((row) => [row.label, row.points]),
    [
      ["Weekly Favorite Pick", 1],
      ["Underdog Bonus", 1],
      ["Immunity Pick", 2],
      ["Vote-Out Pick", 3],
      ["Play Your Advantage", 1],
      ["Immunity Streak", 2],
      ["Shot in the Dark", 3],
    ],
  );
});

test("individual-game and finale awards are part of the episode total", () => {
  const breakdown = buildPointBreakdown({
    pick: { ...pick, underdog_point: 0, streak_point: 0, double_down: "", double_point: 0 },
    phase: "individual",
    castawayName,
    individualGameStarted: true,
    individualGamePick: "ana",
    individualGamePoints: 10,
    finale: true,
    endgamePick: "ana",
    endgamePoints: 5,
  });
  assert.equal(breakdown.roundPoints, 22);
  assert.deepEqual(breakdown.rows.slice(-2), [
    { label: "Opening Outlast Pick", selection: "Ana Sani", points: 10 },
    { label: "Final Torch Pick", selection: "Ana Sani", points: 5 },
  ]);
});

test("Monday email contains fantasy totals and ranks without any outcome fields", () => {
  const email = buildResultsRecapEmail({
    playerName: "Mike <Torch>", teamName: "Blindside & Co.",
    rounds: [{ episodeId: 2, points: -1.5, rank: 2 }],
    overallRank: 2, overallPoints: 7,
    overallLeaders: [{ rank: 1, name: "Camp Chaos", points: 9 }],
    leagueUrl: "https://survivor-fan-game.vercel.app/play",
  });
  assert.match(email.subject, /Tree Mail/);
  assert.match(email.plainText, /Episode 2: -1.5 points · Round rank #2/);
  assert.match(email.plainText, /7 points overall · League rank #2/);
  assert.match(email.html, /Blindside &amp; Co\./);
  assert.doesNotMatch(email.html, /Mike <Torch>/);
  assert.doesNotMatch(JSON.stringify(email), /Voted out:|Immunity winner|Vote-Out Pick|Final Torch Pick|SPOILERS AHEAD/);
  assert.match(email.plainText, /Open when you are caught up/);
});

test("preseason introduces scoring without inventing ranks or an episode result", () => {
  const email = buildResultsRecapEmail({
    playerName: "Mike", teamName: "Torch", rounds: [], overallRank: null,
    overallPoints: 0, overallLeaders: [], leagueUrl: "https://example.test/play",
  });
  assert.match(email.plainText, /season has not started/);
  assert.doesNotMatch(email.plainText, /rank #|0 points overall/);
});
