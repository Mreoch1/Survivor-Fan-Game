import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeView } from "../app/components/HomeView";
import type { HomeSummary } from "../db/home";

const now = Date.parse("2026-09-28T18:00:00Z");
const summary = (): HomeSummary => ({
  loadedAt: now,
  joined: true, displayName: "Example member", episode: { id: 2, title: "Next challenge", lockAt: "2026-09-30T23:00:00Z", revealAt: "2026-10-01T13:00:00Z" },
  pickStatus: "carried", selectedCount: 3, requiredCount: 3, carriedFromEpisodeId: 1, updatedAt: "2026-09-28T09:00:00Z",
  standings: [{ name: "Example team", points: -1, rank: 1, isYou: true }], totalPoints: -1, rank: 1, latestScoredEpisode: 1,
});
const render = (data: HomeSummary | null, signedIn = true) => renderToStaticMarkup(createElement(HomeView, { data, signedIn, now }));

test("member home shows current deadline, carryover status, and real published scores", () => {
  const html = render(summary());
  assert.match(html, /Episode 2 · Next challenge/);
  assert.match(html, /Sep 30/);
  assert.match(html, /Picks carried forward/);
  assert.match(html, /Carried from Episode 1/);
  assert.match(html, /3 of 3 required picks on file/);
  assert.match(html, /Review my picks/);
  assert.match(html, /Scores through Episode 1/);
  assert.match(html, /Example team/);
  assert.match(html, /<b>-1/);
  assert.doesNotMatch(html, /Camp Chaos|Blindside Club|Everybody starts at zero|Join the league/);
});

test("member home distinguishes a deliberate save from carryover", () => {
  const html = render({ ...summary(), pickStatus: "saved", carriedFromEpisodeId: null });
  assert.match(html, /Your picks are saved/);
  assert.match(html, /Saved Monday/);
  assert.doesNotMatch(html, /Picks carried forward/);
});

test("closed episode shows its release time instead of a zero countdown", () => {
  const data = summary();
  data.episode = { ...data.episode!, lockAt: "2026-09-23T23:00:00Z", revealAt: "2026-09-24T13:00:00Z" };
  const html = render(data);
  assert.match(html, /Picks are locked/);
  assert.match(html, /Open Play/);
  assert.match(html, /Results appear after/);
  assert.doesNotMatch(html, /class="countdown"/);
});

test("unscheduled and failed status never show a stale deadline or a confirmed save", () => {
  const unscheduled = render({ ...summary(), episode: null });
  assert.match(unscheduled, /Waiting for the next episode/);
  assert.doesNotMatch(unscheduled, /class="countdown"|Your picks are saved/);
  const failed = render(null);
  assert.match(failed, /Pick status unavailable/);
  assert.doesNotMatch(failed, /season points|Picks are saved|class="countdown"/);
});

test("visitors receive joining guidance without member standings", () => {
  const html = render({ ...summary(), joined: false, displayName: "", standings: [] }, false);
  assert.match(html, /Sign in to make picks/);
  assert.doesNotMatch(html, /Example team|3 of 3|season points/);
});
