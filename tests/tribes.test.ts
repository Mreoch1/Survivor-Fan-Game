import assert from "node:assert/strict";
import test from "node:test";
import { castaways } from "../app/data";
import { applyTribeState, BASELINE_TRIBE_STATE, sameTribeState, validateTribeState, type TribeState } from "../lib/tribes";

const priorDepartures = ["aaliyah-puglia", "ana-sani", "patt-cannaday", "rob-antonson"];
const latestDepartureIds = ["jenna-greenawalt"];
const castIds = castaways.map(castaway => castaway.id);
const activeCastIds = castIds.filter(id => ![...priorDepartures, ...latestDepartureIds].includes(id));
const context = { castIds, previousState: BASELINE_TRIBE_STATE, activeCastIds, latestDepartureIds, individualGameStarted: false };
function fixture(): TribeState {
  const tribes = [...structuredClone(BASELINE_TRIBE_STATE.tribes), { name: "New Tribe", color: "Blue tribe", hex: "#2873A9" }];
  return { ...structuredClone(BASELINE_TRIBE_STATE), afterEpisodeId: 4, tribes,
    assignments: Object.fromEntries(castIds.map(id => [id, priorDepartures.includes(id) ? BASELINE_TRIBE_STATE.assignments[id] : tribes[castIds.indexOf(id) % 3].name])),
    sources: ["https://www.paramountplus.com/episode-recap/", "https://ew.com/survivor-recap/"] };
}

test("a verified swap assigns all 21 castaways while preserving earlier departures", () => {
  const state = validateTribeState(fixture(), context);
  assert.equal(state.tribes.length, 3);
  assert.equal(Object.keys(state.assignments).length, 21);
  for (const id of priorDepartures) assert.equal(state.assignments[id], BASELINE_TRIBE_STATE.assignments[id]);
  assert.equal(state.tribes.find(tribe => tribe.name === "New Tribe")?.hex, "#2873a9");
  const updated = applyTribeState(castaways, state);
  assert.equal(updated.find(castaway => castaway.id === "jenna-greenawalt")?.tribe, "New Tribe");
  assert.equal(updated.find(castaway => castaway.id === "jenna-greenawalt")?.tribeHex, "#2873a9");
  assert.equal(castaways.find(castaway => castaway.id === "jenna-greenawalt")?.tribe, "Toka", "Source cast remains unchanged");
});

test("missing, extra, unsafe or unknown assignments fail rather than partially applying a swap", () => {
  for (const change of [
    (state: TribeState) => { delete state.assignments[castIds[0]]; },
    (state: TribeState) => { state.assignments.unknown = "Savu"; },
    (state: TribeState) => { state.assignments[activeCastIds[0]] = "Unknown"; },
    (state: TribeState) => { state.assignments[activeCastIds[0]] = ""; },
    (state: TribeState) => { state.assignments[priorDepartures[0]] = "New Tribe"; },
    (state: TribeState) => { state.tribes[0].hex = "red;url(https://evil.test)"; },
    (state: TribeState) => { state.tribes[0].name = "<script>"; },
    (state: TribeState) => { state.tribes[0].color = ""; },
    (state: TribeState) => { state.tribes[1].name = state.tribes[0].name.toLowerCase(); },
    (state: TribeState) => { state.tribes.push({ name: "Empty", color: "Green", hex: "#123456" }); },
  ]) {
    const input = fixture(); change(input);
    assert.throws(() => validateTribeState(input, context));
  }
});

test("an old final tribe survives a later merge and is not offered as a current tribe", () => {
  const input = fixture();
  input.phase = "individual";
  input.tribes = [{ name: "Merged", color: "Green tribe", hex: "#123456" }];
  for (const id of [...activeCastIds, ...latestDepartureIds]) input.assignments[id] = "Merged";
  const state = validateTribeState(input, { ...context, individualGameStarted: true });
  assert.equal(state.assignments[priorDepartures[0]], "Toka");
  assert.deepEqual(state.tribes.map(tribe => tribe.name), ["Merged"]);
  input.assignments[latestDepartureIds[0]] = BASELINE_TRIBE_STATE.assignments[latestDepartureIds[0]];
  assert.equal(validateTribeState(input, { ...context, individualGameStarted: true }).assignments[latestDepartureIds[0]], "Toka", "A player who departs before the merge keeps their final tribe");
});

test("only an explicit individual-game record authorizes changing phase", () => {
  const state = fixture(); state.phase = "individual";
  assert.throws(() => validateTribeState(state, context), /recorded/);
  assert.equal(validateTribeState(state, { ...context, individualGameStarted: true }).phase, "individual");
  assert.throws(() => validateTribeState(fixture(), { ...context, individualGameStarted: true }), /recorded/);
  assert.throws(() => validateTribeState(fixture(), { ...context, previousState: { ...BASELINE_TRIBE_STATE, phase: "individual" } }), /recorded/);
});

test("snapshot IDs must advance and evidence needs both official and independent public URLs", () => {
  for (const afterEpisodeId of [0, -1, 1.5, NaN]) assert.throws(() => validateTribeState({ ...fixture(), afterEpisodeId }, context));
  assert.throws(() => validateTribeState(fixture(), { ...context, previousState: { ...BASELINE_TRIBE_STATE, afterEpisodeId: 4 } }), /episode ID/);
  for (const sources of [[], ["https://www.cbs.com/a", "https://www.paramountplus.com/b"], ["https://cbs.com.evil.test/a", "https://ew.com/b"],
    ["http://www.cbs.com/a", "https://ew.com/b"], ["https://secret@www.cbs.com/a", "https://ew.com/b"], ["not-a-url", "https://ew.com/b"]]) {
    assert.throws(() => validateTribeState({ ...fixture(), sources }, context));
  }
});

test("canonical snapshot comparison makes reordered requests idempotent", () => {
  const first = validateTribeState(fixture(), context);
  const reordered = { ...first, tribes: [...first.tribes].reverse().map(({ name, color, hex }) => ({ hex, name, color })), sources: [...first.sources].reverse(), assignments: Object.fromEntries(Object.entries(first.assignments).reverse()) };
  assert.equal(sameTribeState(first, reordered), true);
  assert.equal(sameTribeState(first, { ...first, afterEpisodeId: 5 }), false);
});
