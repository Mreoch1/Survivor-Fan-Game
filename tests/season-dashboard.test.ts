import assert from "node:assert/strict";
import test from "node:test";
import { buildSeasonDashboard } from "../lib/season-dashboard";
import { readAllRows } from "../lib/read-all-rows";
import { carryWildCardAnswer } from "../lib/wild-card-carryover";

import { profiles, episode, pick, input } from "./fixtures/season";

test("scorecards reconcile weekly points, one-time season awards, and half points", () => {
  const dashboard = buildSeasonDashboard(input());
  assert.equal(dashboard.totalPoints, 21.5); // 10 weekly + 10 opening + 1.5 finale
  assert.equal(dashboard.history.reduce((sum, row) => sum + row.points, 0), dashboard.totalPoints);
  assert.equal(dashboard.history[0].totalPoints, dashboard.totalPoints);
  assert.deepEqual(dashboard.history.map(row => row.points), [4.5, 1, 13, 3]);
  assert.equal(dashboard.history[0].rows.at(-1)?.points, 1.5);
  assert.equal(dashboard.history[2].rows.at(-1)?.label, "Opening Outlast Pick");
  assert.equal(dashboard.history[1].carriedFromEpisodeId, 2);
});

test("post-merge starts after the announcement episode and excludes both season awards", () => {
  const dashboard = buildSeasonDashboard(input());
  assert.equal(dashboard.postMerge.announcementEpisodeId, 2);
  assert.equal(dashboard.postMerge.episodesScored, 2);
  assert.deepEqual(dashboard.postMerge.standings.map(row => [row.name, row.points]), [["Camp Bravo (Blair)", 9], ["Camp Alpha (Alex)", 4]]);
  assert.deepEqual(dashboard.history.map(row => row.countsForPostMerge), [true, true, false, false]);
});

test("a hidden or early-published episode cannot reveal scores, a merge, or player selections", () => {
  const args = input();
  args.episodes = [episode(1), episode(2, { individual_game_started: true, results_published: false }), episode(3, { individual_game_started: true, reveal_at: "2027-01-01T00:00:00Z" })];
  args.picks.push(pick("a", 3, { favorite_id: "SECRET_FUTURE_PICK", boot_point: 99 }));
  const dashboard = buildSeasonDashboard(args);
  assert.equal(dashboard.totalPoints, 3);
  assert.equal(dashboard.history.length, 1);
  assert.equal(dashboard.spotlight?.episodeId, 1);
  assert.equal(dashboard.postMerge.announcementEpisodeId, null);
  assert.doesNotMatch(JSON.stringify(dashboard), /SECRET_FUTURE_PICK/);
});

test("ties share ranks and highlights; moving into a tie counts as a climb", () => {
  const args = input();
  args.episodes = [episode(1), episode(2)];
  args.picks = [pick("a", 1), pick("b", 1, { immunity_point: 0 }), pick("a", 2, { immunity_point: 0 }), pick("b", 2)];
  const dashboard = buildSeasonDashboard(args);
  assert.deepEqual(dashboard.overall.map(row => row.rank), [1, 1]);
  assert.deepEqual(dashboard.spotlight?.climbers, ["Camp Bravo (Blair)"]);
  assert.equal(dashboard.spotlight?.placesClimbed, 1);
  const tied = buildSeasonDashboard({ ...args, picks: [pick("a", 1), pick("b", 1), pick("a", 2), pick("b", 2)] });
  assert.deepEqual(tied.spotlight?.winners, ["Camp Alpha (Alex)", "Camp Bravo (Blair)"]);
});

test("missing weekly picks show zero and keep eligible season-pick awards", () => {
  const args = input();
  args.picks = args.picks.filter(row => !(row.user_id === "a" && row.episode_id === 2));
  const dashboard = buildSeasonDashboard(args);
  assert.equal(dashboard.history[2].hasPick, false);
  assert.equal(dashboard.history[2].points, 10);
  assert.equal(dashboard.history[2].rows[0].selection, "No pick on file");
});

test("late joiners have no fabricated prior rounds and members cannot request someone else's picks", () => {
  const args = input();
  args.profiles = [...profiles, { ...profiles[0], id: "late", display_name: "Late", team_name: "Late Camp", league_joined_at: "2026-09-23T12:00:00Z", individual_game_pick: null, endgame_pick: null }];
  const dashboard = buildSeasonDashboard({ ...args, viewerId: "late" });
  assert.deepEqual(dashboard.history.map(row => row.episodeId), [4, 3]);
  assert.equal(dashboard.history.at(-1)?.movement, null);
  assert.equal(dashboard.totalPoints, 0);
  assert.throws(() => buildSeasonDashboard({ ...args, viewerId: "outsider" }), /membership required/);
  const privateInput = input();
  privateInput.picks[1].favorite_id = "OTHER_PLAYERS_PRIVATE_DETAIL";
  assert.doesNotMatch(JSON.stringify(buildSeasonDashboard(privateInput)), /OTHER_PLAYERS_PRIVATE_DETAIL/);
});

test("empty season has no fake ranks or winners, and void immunity is explained", () => {
  const empty = buildSeasonDashboard({ ...input(), episodes: [] });
  assert.equal(empty.overallRank, null);
  assert.equal(empty.spotlight, null);
  assert.deepEqual(empty.history, []);
  const args = input();
  args.results[2].immunity_void = true;
  const dashboard = buildSeasonDashboard(args);
  assert.equal(dashboard.history[1].immunityVoid, true);
});

test("missing published results fail closed instead of showing an incomplete total", () => {
  assert.throws(() => buildSeasonDashboard({ ...input(), results: [] }), /missing its results/);
});

test("Wild Card carryover follows the question, not a reused Yes/No answer", () => {
  const base = { answer: "Yes", previousQuestion: "Will someone find an idol?", nextQuestion: "Will someone quit?", nextOptions: ["Yes", "No"] };
  assert.equal(carryWildCardAnswer(base), "");
  assert.equal(carryWildCardAnswer({ ...base, nextQuestion: "Will someone find an idol?" }), "Yes");
  assert.equal(carryWildCardAnswer({ ...base, nextQuestion: " Will someone  find an idol? " }), "Yes");
  assert.equal(carryWildCardAnswer({ ...base, nextQuestion: base.previousQuestion, nextOptions: ["One", "Two"] }), "");
  assert.equal(carryWildCardAnswer({ ...base, previousQuestion: "", nextQuestion: "" }), "");
});

test("season queries collect every page and propagate database errors", async () => {
  const population = Array.from({ length: 1201 }, (_, id) => ({ id }));
  let calls = 0;
  const rows = await readAllRows(async (from, to) => { calls++; return { data: population.slice(from, to + 1), error: null }; });
  assert.equal(calls, 3);
  assert.deepEqual(rows, population);
  await assert.rejects(readAllRows(async () => ({ data: null, error: new Error("Unavailable") })), /Unavailable/);
});
