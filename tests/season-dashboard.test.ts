import assert from "node:assert/strict";
import test from "node:test";
import { buildSeasonDashboard } from "../lib/season-dashboard";
import type { PopupQuestion, PopupVote } from "../lib/popup-questions";
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

test("a voided question explains zero for every answer, skip, and missing submission without changing historical choices", () => {
  const args = input();
  const originalQuestion = "Will an idol or advantage be played?";
  args.episodes = [episode(1, { bonus_question: originalQuestion })];
  args.results[0] = { ...args.results[0], bonus_answer: "" };
  args.profiles = [...profiles,
    { ...profiles[0], id: "skipped", display_name: "Skipped", team_name: "Skipped Camp" },
    { ...profiles[0], id: "missing", display_name: "Missing", team_name: "Missing Camp" },
  ];
  args.picks = [pick("a", 1, { bonus_pick: "No", double_down: "bonus" }),
    pick("b", 1, { bonus_pick: "Yes" }), pick("skipped", 1, { bonus_pick: "" })];
  const dashboard = buildSeasonDashboard(args);
  assert.equal(dashboard.history[0].bonusQuestion, originalQuestion);
  assert.deepEqual(dashboard.history[0].rows.find(row => row.label === "Play Your Advantage"), {
    label: "Play Your Advantage", selection: "No", points: 0, outcome: "Question voided — no points awarded",
  });
  assert.equal(dashboard.history[0].rows.find(row => row.label === "Shot in the Dark")?.outcome, "Question voided — no extra points awarded");
  for (const member of dashboard.overall) {
    const round = member.episodes[0];
    assert.deepEqual(round.rows.find(row => row.label === "Play Your Advantage"), {
      label: "Play Your Advantage", points: 0, outcome: "Question voided — no points awarded",
    });
    assert.equal(round.rows.reduce((sum, row) => sum + row.points, 0), round.points);
    assert.equal(round.points, member.points);
  }
  assert.equal(dashboard.overall.find(member => member.id === "missing")?.points, 0);
});

test("a persisted void correction restores the penalty in all totals without changing other components", () => {
  const args = input();
  args.episodes = [episode(1)];
  args.results[0] = { ...args.results[0], bonus_answer: "Yes" };
  args.picks = [pick("a", 1, { bonus_pick: "No", bonus_point: -1 }), pick("b", 1, { bonus_pick: "" })];
  const before = buildSeasonDashboard(args);
  args.results[0] = { ...args.results[0], bonus_answer: "" };
  args.picks[0] = { ...args.picks[0], bonus_point: 0 };
  const after = buildSeasonDashboard(args);
  assert.equal(after.totalPoints, before.totalPoints + 1);
  assert.equal(after.history[0].points, before.history[0].points + 1);
  assert.equal(after.overall.find(member => member.id === "a")!.points, before.overall.find(member => member.id === "a")!.points + 1);
  assert.equal(after.overall.find(member => member.id === "b")!.points, before.overall.find(member => member.id === "b")!.points);
  assert.deepEqual(after.history[0].rows.filter(row => row.label !== "Play Your Advantage"), before.history[0].rows.filter(row => row.label !== "Play Your Advantage"));
});

test("missing answer fields and hidden void results never imply a published void", () => {
  const args = input();
  args.episodes = [episode(1), episode(2, { results_published: false }), episode(3, { reveal_at: "2999-01-01T00:00:00Z" })];
  args.results[1] = { ...args.results[1], bonus_answer: "" };
  args.results[2] = { ...args.results[2], bonus_answer: "" };
  args.picks[0] = { ...args.picks[0], bonus_point: -1 };
  const dashboard = buildSeasonDashboard(args);
  assert.equal(dashboard.history[0].rows.find(row => row.label === "Play Your Advantage")?.outcome, "Incorrect answer");
  assert.doesNotMatch(JSON.stringify(dashboard), /Question voided/);
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


const popupQuestion = (id: string, extra: Partial<PopupQuestion> = {}): PopupQuestion => ({ id, question: `Popup ${id}?`, details: "One exact event in the named episode.", credit_name: "", points: 3, status: "resolved", correct_answer: "Yes", resolution_episode_id: 1, opens_at: "2026-09-20T12:00:00Z", closes_at: "2026-09-21T12:00:00Z", reveal_at: "2026-09-22T13:00:00Z", ...extra });
const popupVote = (questionId: string, userId: string, answer: PopupVote["answer"]): PopupVote => ({ question_id: questionId, user_id: userId, answer, voted_at: "2026-09-20T13:00:00Z" });

test("popup awards add to season totals and ranks without changing episode scores or late-award history", () => {
 const base = buildSeasonDashboard(input());
 const dashboard = buildSeasonDashboard({ ...input(), popupQuestions: [popupQuestion("first"), popupQuestion("later", { resolution_episode_id: 4, reveal_at: "2026-09-28T10:30:00Z" }), popupQuestion("another", { resolution_episode_id: 4, reveal_at: "2026-09-28T10:30:00Z" })], popupVotes: [popupVote("first", "a", "Yes"), popupVote("first", "b", "No"), popupVote("later", "a", "Skip"), popupVote("later", "b", "Yes"), popupVote("another", "b", "Yes")] });
 assert.equal(dashboard.popupPoints, 3);
 assert.equal(dashboard.totalPoints, 24.5);
 assert.equal(dashboard.history.reduce((sum, round) => sum + round.points, 0) + dashboard.popupPoints, dashboard.totalPoints);
 assert.deepEqual(dashboard.overall.map(row => [row.id, row.points, row.popupPoints, row.rank]), [["b", 26, 6, 1], ["a", 24.5, 3, 2]]);
 assert.deepEqual(dashboard.history.map(row => row.points), base.history.map(row => row.points));
 assert.deepEqual(dashboard.history.map(row => row.totalPoints), [24.5, 20, 19, 6]);
 assert.deepEqual(dashboard.overall[0].episodes.map(round => round.totalPoints), base.overall.find(row => row.id === "b")!.episodes.map(round => round.totalPoints), "Later popup awards must not rewrite earlier episode totals");
 assert.deepEqual(dashboard.spotlight, base.spotlight, "Later popup results cannot rewrite the latest episode's winners or movement");
 assert.equal(dashboard.overallMovement, -1);
 assert.equal(dashboard.movementLabel, "Since Episode 4");
 assert.equal(dashboard.popupHistory.find(row => row.questionId === "later")?.selection, "Skipped");
 assert.doesNotMatch(JSON.stringify(dashboard.overall), /"selection"|"answer"|"correct_answer"|"voted_at"/);
 assert.deepEqual(Object.keys(dashboard.overall[0].popups[0]).sort(), ["outcome", "points", "question", "questionId", "revealAt"]);
});

test("popup results require their own reveal and a published revealed resolution episode", () => {
 const args = input();
 const questions = [
  popupQuestion("open", { question: "SECRET_OPEN_POPUP", status: "open" }),
  popupQuestion("future", { question: "SECRET_FUTURE_POPUP", reveal_at: "2999-01-01T10:30:00Z" }),
  popupQuestion("unpublished", { question: "SECRET_UNPUBLISHED_POPUP", resolution_episode_id: 5 }),
  popupQuestion("early-episode", { question: "SECRET_EARLY_POPUP", resolution_episode_id: 6 }),
  popupQuestion("missing", { question: "SECRET_MISSING_EPISODE", resolution_episode_id: 999 }),
  popupQuestion("unlinked", { question: "SECRET_UNLINKED_POPUP", resolution_episode_id: null }),
 ];
 args.episodes.push(episode(5, { results_published: false }), episode(6, { reveal_at: "2999-01-01T10:30:00Z" }));
 const dashboard = buildSeasonDashboard({ ...args, popupQuestions: questions, popupVotes: questions.map(question => popupVote(question.id, "a", "Yes")) });
 assert.equal(dashboard.popupPoints, 0);
 assert.equal(dashboard.totalPoints, 21.5);
 assert.deepEqual(dashboard.popupHistory, []);
 assert.doesNotMatch(JSON.stringify(dashboard), /SECRET_/);
});

test("popup scoring includes valid late joiners without inventing weekly picks and preserves void zeros", () => {
 const args = input();
 args.profiles = [...args.profiles, { ...profiles[0], id: "late", league_joined_at: "2026-09-26T12:00:00Z", individual_game_pick: null, endgame_pick: null }];
 const question = popupQuestion("late", { opens_at: "2026-09-26T00:00:00Z", closes_at: "2026-09-27T00:00:00Z", resolution_episode_id: 4, reveal_at: "2026-09-28T10:30:00Z" });
 const dashboard = buildSeasonDashboard({ ...args, viewerId: "late", popupQuestions: [question, { ...question, id: "void", status: "void", correct_answer: null }], popupVotes: [popupVote("late", "late", "Yes"), popupVote("void", "late", "Yes")] });
 assert.equal(dashboard.totalPoints, 3);
 assert.equal(dashboard.popupPoints, 3);
 assert.deepEqual(dashboard.history, []);
 assert.equal(dashboard.overall.find(row => row.isYou)?.episodes.length, 0);
 assert.equal(dashboard.popupHistory.find(row => row.questionId === "void")?.points, 0);
 assert.match(dashboard.popupHistory.find(row => row.questionId === "void")!.outcome, /voided/);
 assert.equal(dashboard.overallRank, 3);
});

test("popup reveal timing is inclusive and empty episode history cannot expose an unlinked award", () => {
 const question = popupQuestion("boundary", { reveal_at: "2026-09-28T10:30:00Z" });
 const args = { ...input(), popupQuestions: [question], popupVotes: [popupVote("boundary", "a", "Yes")] };
 assert.equal(buildSeasonDashboard({ ...args, now: new Date("2026-09-28T10:29:59.999Z") }).popupPoints, 0);
 assert.equal(buildSeasonDashboard({ ...args, now: new Date("2026-09-28T10:30:00Z") }).popupPoints, 3);
 const empty = buildSeasonDashboard({ ...args, episodes: [] });
 assert.equal(empty.totalPoints, 0);
 assert.equal(empty.overallRank, null);
 assert.deepEqual(empty.popupHistory, []);
});


test("a Monday afternoon popup resolution never rewrites that morning's episode snapshot", () => {
 const args = input();
 args.episodes = args.episodes.map(row => row.id === 4 ? { ...row, reveal_at: "2026-09-28T10:30:00Z" } : row);
 const question = popupQuestion("afternoon", { resolution_episode_id: 4, reveal_at: "2026-09-28T10:30:00Z", resolved_at: "2026-09-28T17:00:00Z" });
 const popupVotes = [popupVote("afternoon", "b", "Yes")];
 const before = buildSeasonDashboard({ ...args, popupQuestions: [question], popupVotes, now: new Date("2026-09-28T16:59:59Z") });
 assert.equal(before.overall.find(row => row.id === "b")?.points, 20);
 assert.deepEqual(before.overall.find(row => row.id === "b")?.popups, []);
 const after = buildSeasonDashboard({ ...args, popupQuestions: [question], popupVotes, now: new Date("2026-09-28T17:00:00Z") });
 const player = after.overall.find(row => row.id === "b")!;
 assert.equal(player.points, 23);
 assert.equal(player.popupPoints, 3);
 assert.equal(player.episodes[0].totalPoints, 20, "Morning history keeps the score that was available at the episode reveal");
 assert.equal(player.popups[0].revealAt, "2026-09-28T17:00:00.000Z");
 assert.equal(player.movement, 1);
 assert.equal(player.movementLabel, "Since Episode 4");
});
