import assert from "node:assert/strict";
import test from "node:test";
import { buildWeeklyPickPayload, getPickCompletion, getPickSaveState, isPickDirty, savePickRequest, type SavedWeeklyPick, type WeeklyPickDraft } from "../lib/pick-form";

const draft: WeeklyPickDraft = { favoriteId: "favorite", immunityPick: "Savu", bootPick: "boot", bonusPick: "", shotInTheDark: "", individualGamePick: "opening" };
const saved: SavedWeeklyPick = { favoriteId: "favorite", immunityPick: "Savu", bootPick: "boot", bonusPick: "", shotInTheDark: "", carriedFromEpisodeId: null, updatedAt: "2026-09-28T12:00:00Z" };

test("weekly saves omit locked opening picks, including an empty opening pick in Episode 2", () => {
  for (const individualGamePick of ["", "opening"]) {
    const payload = buildWeeklyPickPayload({ ...draft, individualGamePick }, 2, false);
    assert.equal(Object.hasOwn(payload, "individualGamePick"), false);
    assert.equal(payload.episodeId, 2);
    assert.equal(payload.favoriteId, draft.favoriteId);
  }
  assert.equal(Object.hasOwn(buildWeeklyPickPayload(draft, 1, false), "individualGamePick"), false);
  assert.equal(Object.hasOwn(buildWeeklyPickPayload(draft, 2, true), "individualGamePick"), false);
  assert.equal(buildWeeklyPickPayload(draft, 1, true).individualGamePick, "opening", "An unlocked Episode 1 submission retains the required opening selection");
});

test("completion requires the three weekly picks and only requires the opening pick before its deadline", () => {
  assert.equal(getPickCompletion(draft).complete, true);
  const opening = getPickCompletion({ ...draft, individualGamePick: "" }, true);
  assert.deepEqual(opening.missing.map(item => item.id), ["opening-outlast-pick"]);
  assert.equal(opening.total, 4);
  assert.equal(getPickCompletion({ ...draft, individualGamePick: "" }, false).total, 3);
  assert.deepEqual(getPickCompletion({ immunityPick: "Toka" }).missing.map(item => item.id), ["weekly-favorite", "weekly-vote-out"]);
});

test("carried-forward picks remain distinct from an explicit save, including partial carryover", () => {
  const carried = { ...saved, carriedFromEpisodeId: 1 };
  assert.equal(getPickSaveState(draft, carried, "opening", false), "carried");
  assert.equal(getPickSaveState({ ...draft, bootPick: "" }, { ...carried, bootPick: "" }, "opening", false), "missing");
  assert.equal(getPickSaveState({ ...draft, bonusPick: "Yes" }, carried, "opening", false), "unsaved");
  assert.equal(getPickSaveState(draft, saved, "opening", false), "saved");
});

test("a save response marks only the submitted snapshot as saved and leaves newer edits dirty", () => {
  assert.equal(isPickDirty(draft, saved, "opening", false), false);
  const whileSaving = { ...draft, favoriteId: "new-favorite", bonusPick: "Yes", shotInTheDark: "bonus" };
  assert.equal(getPickSaveState(whileSaving, saved, "opening", false), "unsaved");
  assert.equal(isPickDirty({ ...draft, individualGamePick: "new-opening" }, saved, "opening", true), true);
  assert.equal(isPickDirty({ ...draft, individualGamePick: "new-opening" }, saved, "opening", false), false);
});

test("save sends the complete draft and uses only a confirmed server receipt", async () => {
  const payload = { ...draft, episodeId: 2 };
  const result = await savePickRequest("/api/picks", payload, async (url, init) => {
    assert.equal(url, "/api/picks");
    assert.equal(init?.method, "PUT");
    assert.deepEqual(JSON.parse(String(init?.body)), payload);
    return Response.json({ ok: true, updatedAt: saved.updatedAt });
  });
  assert.equal(result.updatedAt, saved.updatedAt);
});

test("network failure is recoverable and a retry can confirm the same selections", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls++;
    if (calls === 1) throw new TypeError("Network request failed");
    return Response.json({ ok: true, updatedAt: saved.updatedAt });
  };
  await assert.rejects(savePickRequest("/api/picks", draft, fetcher), /Check your connection/);
  assert.equal((await savePickRequest("/api/picks", draft, fetcher)).updatedAt, saved.updatedAt);
});

test("server validation, sign-in, and deadline errors cannot show a success state", async () => {
  for (const [status, error] of [[400, "Choose your Weekly Favorite"], [401, "Sign in required"], [409, "Picks are locked for this episode"]] as const) {
    await assert.rejects(savePickRequest("/api/picks", draft, async () => Response.json({ error }, { status })), { message: error });
  }
});

test("malformed or incomplete success responses cannot fabricate a saved timestamp", async () => {
  for (const response of [new Response("<html>Login</html>"), Response.json({ ok: true }), Response.json({ ok: true, updatedAt: "invalid" }), Response.json({ updatedAt: saved.updatedAt })]) {
    await assert.rejects(savePickRequest("/api/picks", draft, async () => response), /Couldn’t confirm the save/);
  }
});

test("Final Torch uses the same reliable save contract without changing weekly selections", async () => {
  const result = await savePickRequest("/api/endgame-pick", { castawayId: "finalist" }, async () => Response.json({ ok: true, castawayId: "finalist", switched: true, updatedAt: saved.updatedAt }));
  assert.equal(result.castawayId, "finalist");
  assert.equal(result.switched, true);
});


test("one-time Episode 2 opening grace sends only a selected opening pick while it is unlocked", () => {
  assert.equal(buildWeeklyPickPayload(draft, 2, true, true).individualGamePick, "opening");
  assert.equal(Object.hasOwn(buildWeeklyPickPayload({ ...draft, individualGamePick: "" }, 2, true, true), "individualGamePick"), false, "Weekly picks can save without using the one-time opening choice");
  assert.equal(Object.hasOwn(buildWeeklyPickPayload(draft, 2, false, true), "individualGamePick"), false, "An expired grace window cannot send an opening change");
  assert.equal(Object.hasOwn(buildWeeklyPickPayload(draft, 3, true, true), "individualGamePick"), false, "Grace cannot carry into a later episode");
});

test("an optional grace opening selection becomes unsaved without adding a required weekly pick", () => {
  const emptyOpening = { ...draft, individualGamePick: "" };
  assert.equal(getPickCompletion(emptyOpening, false).complete, true);
  assert.equal(getPickSaveState(emptyOpening, saved, "", false, true), "saved");
  assert.equal(getPickSaveState(draft, saved, "", false, true), "unsaved");
  assert.equal(getPickSaveState(draft, saved, "opening", false, false), "saved", "The confirmed one-time choice is locked");
});
