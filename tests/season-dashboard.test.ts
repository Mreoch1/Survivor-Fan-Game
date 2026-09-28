import assert from "node:assert/strict";
import test from "node:test";
import { buildSeasonDashboard } from "../lib/season-dashboard";
import { readAllRows } from "../lib/read-all-rows";

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

test("one season leaderboard carries all points through the individual game and finale", () => {
  const dashboard = buildSeasonDashboard(input());
  assert.deepEqual(dashboard.history.map(row => row.totalPoints), [21.5, 17, 16, 3]);
  assert.deepEqual(dashboard.overall.map(row => [row.name, row.points]), [["Camp Alpha (Alex)", 21.5], ["Camp Bravo (Blair)", 20]]);
  assert.equal("postMerge" in dashboard, false);
  assert.ok(dashboard.history.every(row => !("countsForPostMerge" in row)));
});

test("a hidden or early-published episode cannot reveal scores, a merge, or player selections", () => {
  const args = input();
  args.episodes = [episode(1), episode(2, { individual_game_started: true, results_published: false }), episode(3, { individual_game_started: true, reveal_at: "2027-01-01T00:00:00Z" })];
  args.picks.push(pick("a", 3, { favorite_id: "SECRET_FUTURE_PICK", boot_point: 99 }));
  const dashboard = buildSeasonDashboard(args);
  assert.equal(dashboard.totalPoints, 3);
  assert.equal(dashboard.history.length, 1);
  assert.equal(dashboard.spotlight?.episodeId, 1);
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


test("season queries collect every page and propagate database errors", async () => {
  const population = Array.from({ length: 1201 }, (_, id) => ({ id }));
  let calls = 0;
  const rows = await readAllRows(async (from, to) => { calls++; return { data: population.slice(from, to + 1), error: null }; });
  assert.equal(calls, 3);
  assert.deepEqual(rows, population);
  await assert.rejects(readAllRows(async () => ({ data: null, error: new Error("Unavailable") })), /Unavailable/);
});

test("Play Your Advantage penalties reduce the same season total and zero ranks above a loss", () => {
  const args = input();
  args.episodes = [episode(1)];
  args.picks = [pick("a", 1, { favorite_point: 0, immunity_point: 0, bonus_point: -1 }), pick("b", 1, { favorite_point: 0, immunity_point: 0, bonus_pick: "" })];
  const dashboard = buildSeasonDashboard(args);
  assert.equal(dashboard.totalPoints, -1);
  assert.equal(dashboard.history[0].points, -1);
  assert.deepEqual(dashboard.history[0].rows.find(row => row.label === "Play Your Advantage"), { label: "Play Your Advantage", selection: "Yes", points: -1, outcome: "Incorrect answer" });
  assert.deepEqual(dashboard.overall.map(row => [row.name, row.points, row.rank]), [["Camp Bravo (Blair)", 0, 1], ["Camp Alpha (Alex)", -1, 2]]);
});


test("every member's episode categories reconcile to their running total without selection fields", () => {
  const dashboard = buildSeasonDashboard(input());
  for (const member of dashboard.overall) {
    assert.equal(member.episodes.reduce((total, episode) => total + episode.points, 0), member.points);
    assert.equal(member.episodes[0].totalPoints, member.points);
    assert.equal(member.latestPoints, member.episodes[0].points);
    assert.equal(member.latestEpisodeId, 4);
    for (const episode of member.episodes) {
      assert.equal(episode.rows.reduce((total, row) => total + row.points, 0), episode.points);
      assert.ok(episode.rows.every(row => Object.keys(row).sort().join(",") === "label,outcome,points"));
    }
  }
  assert.equal(dashboard.latestPublishedEpisodeId, 4);
  assert.equal(dashboard.overall[0].latestPoints, 4.5);
  assert.equal(dashboard.overall[1].latestPoints, 8);
  assert.match(dashboard.overall[0].episodes[0].rows.at(-1)!.outcome, /Final three.*half points/);
});

test("member score drilldowns strip every other player's weekly and season selection", () => {
  const args = input();
  args.profiles = args.profiles.map(profile => profile.id === "b" ? {
    ...profile, individual_game_pick: "PRIVATE_OPENING", endgame_pick: "PRIVATE_FINAL",
  } : profile);
  args.picks = args.picks.map(row => row.user_id === "b" ? {
    ...row, favorite_id: "PRIVATE_FAVORITE", immunity_pick: "PRIVATE_IMMUNITY",
    boot_pick: "PRIVATE_VOTE", bonus_pick: "PRIVATE_ANSWER", double_down: "boot",
  } : row);
  const dashboard = buildSeasonDashboard(args);
  assert.equal(dashboard.overall.find(member => member.id === "b")!.episodes.length, 4);
  assert.doesNotMatch(JSON.stringify(dashboard), /PRIVATE_/);
  assert.ok(dashboard.history[0].rows.some(row => row.selection === "safe"), "The viewer keeps their own selections");
});

test("public drilldowns keep hidden rounds and future awards out of all payloads", () => {
  const args = input();
  args.episodes = [episode(1), episode(2, { title: "SECRET_UNPUBLISHED", results_published: false }), episode(3, { title: "SECRET_EARLY", reveal_at: "2999-01-01T00:00:00Z" })];
  const dashboard = buildSeasonDashboard(args);
  assert.equal(dashboard.latestPublishedEpisodeId, 1);
  assert.ok(dashboard.overall.every(member => member.episodes.length === 1 && member.latestEpisodeId === 1));
  assert.doesNotMatch(JSON.stringify(dashboard), /SECRET_|Opening Outlast Pick|Final Torch Pick/);
});

test("outcomes distinguish missing, skipped, incorrect, void, and bonus points", () => {
  const args = input();
  args.episodes = [episode(1), episode(2)];
  args.results[1].immunity_void = true;
  args.picks = [pick("a", 1, { favorite_id: "", favorite_point: 0, bonus_point: -1, immunity_point: 0 }),
    pick("a", 2, { immunity_point: 0, bonus_pick: "", underdog_point: 1, streak_point: 2, double_down: "boot", double_point: 0 })];
  const dashboard = buildSeasonDashboard(args);
  const [second, first] = dashboard.overall.find(member => member.isYou)!.episodes;
  assert.equal(first.rows.find(row => row.label === "Weekly Favorite Pick")!.outcome, "No pick on file");
  assert.equal(first.rows.find(row => row.label === "Immunity Pick")!.outcome, "Incorrect prediction");
  assert.equal(first.rows.find(row => row.label === "Play Your Advantage")!.outcome, "Incorrect answer");
  assert.match(second.rows.find(row => row.label === "Immunity Pick")!.outcome, /Void.*streak preserved/);
  assert.match(second.rows.find(row => row.label === "Play Your Advantage")!.outcome, /Skipped/);
  assert.match(second.rows.find(row => row.label === "Underdog Bonus")!.outcome, /Fewer than 20%/);
  assert.match(second.rows.find(row => row.label === "Immunity Streak")!.outcome, /Three consecutive/);
  assert.equal(second.rows.find(row => row.label === "Shot in the Dark")!.outcome, "No extra points earned");
  assert.equal(dashboard.overall.find(member => member.id === "b")!.episodes[0].points, 0);
});

test("leaderboard movement follows shared ranks and late members get no invented episode", () => {
  const args = input();
  args.episodes = [episode(1), episode(2)];
  args.picks = [pick("a", 1), pick("b", 1, { immunity_point: 0 }), pick("a", 2, { immunity_point: 0 }), pick("b", 2)];
  args.profiles = [...profiles, { ...profiles[0], id: "new", display_name: "New", team_name: "New Camp", league_joined_at: "2026-10-01T00:00:00Z", individual_game_pick: null, endgame_pick: null }];
  const dashboard = buildSeasonDashboard(args);
  const rising = dashboard.overall.find(member => member.id === "b")!;
  assert.equal(rising.rank, 1);
  assert.equal(rising.movement, 1);
  assert.equal(rising.episodes[0].movement, 1);
  const newcomer = dashboard.overall.find(member => member.id === "new")!;
  assert.deepEqual(newcomer.episodes, []);
  assert.equal(newcomer.latestPoints, null);
  assert.equal(newcomer.latestEpisodeId, null);
  assert.equal(newcomer.movement, null);
});
