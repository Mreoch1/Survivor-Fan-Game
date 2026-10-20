import { castaways } from "../app/data";

export type Tribe = { name: string; color: string; hex: string };
export type TribeState = {
  afterEpisodeId: number;
  phase: "tribe" | "individual";
  tribes: Tribe[];
  assignments: Record<string, string>;
  sources: string[];
};

// Compatibility baseline for episodes played before verified snapshots existed.
// It is never written as a verified episode snapshot.
export const BASELINE_TRIBE_STATE: TribeState = {
  afterEpisodeId: 0,
  phase: "tribe",
  tribes: [
    { name: "Savu", color: "Purple tribe", hex: "#6d4b86" },
    { name: "Toka", color: "Yellow tribe", hex: "#dabd24" },
  ],
  assignments: Object.fromEntries(castaways.map(castaway => [castaway.id, castaway.tribe])),
  sources: [],
};

export type TribeValidationContext = {
  castIds: readonly string[];
  previousState: TribeState;
  activeCastIds: readonly string[];
  latestDepartureIds?: readonly string[];
  individualGameStarted: boolean;
};

const officialDomains = ["cbs.com", "paramountplus.com", "paramountpressexpress.com"];
const isOfficial = (hostname: string) => officialDomains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const cleanLabel = (value: unknown, max: number) => typeof value === "string" && value === value.trim() && value.length <= max && /^[\p{L}\p{N}][\p{L}\p{N} '\u2019-]*$/u.test(value);

/** Validate a complete, sourced state. Throws rather than silently dropping bad assignments. */
export function validateTribeState(input: unknown, context: TribeValidationContext): TribeState {
  if (!isRecord(input) || !Number.isSafeInteger(input.afterEpisodeId) || Number(input.afterEpisodeId) < 1 ||
    Number(input.afterEpisodeId) <= context.previousState.afterEpisodeId) {
    throw new Error("Use the exact new episode ID after the previous tribe snapshot");
  }
  const expectedPhase = context.individualGameStarted ? "individual" : "tribe";
  if (input.phase !== expectedPhase || (context.previousState.phase === "individual" && input.phase !== "individual")) {
    throw new Error("Tribe phase must match the recorded individual-game announcement");
  }
  if (!Array.isArray(input.tribes) || input.tribes.length < 1 || input.tribes.length > 6) {
    throw new Error("Provide one to six current tribes");
  }
  const tribes: Tribe[] = input.tribes.map(value => {
    if (!isRecord(value) || !cleanLabel(value.name, 40) || !cleanLabel(value.color, 40) ||
      typeof value.hex !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value.hex)) {
      throw new Error("Every tribe needs a name, color label, and six-digit hex color");
    }
    return { name: value.name as string, color: value.color as string, hex: value.hex.toLowerCase() };
  }).sort((a, b) => a.name.localeCompare(b.name));
  if (new Set(tribes.map(tribe => tribe.name.toLowerCase())).size !== tribes.length) throw new Error("Tribe names must be unique");
  if (!isRecord(input.assignments)) throw new Error("Provide the complete cast tribe assignments");
  const expectedIds = [...context.castIds].sort();
  if (JSON.stringify(Object.keys(input.assignments).sort()) !== JSON.stringify(expectedIds)) {
    throw new Error("Assignments must contain every exact cast ID once, with no unknown IDs");
  }
  const currentNames = new Set(tribes.map(tribe => tribe.name));
  const active = new Set(context.activeCastIds);
  const canMove = new Set([...active, ...(context.latestDepartureIds || [])]);
  if ([...canMove].some(id => !expectedIds.includes(id))) throw new Error("Unknown cast ID in tribe validation context");
  const assignments: Record<string, string> = {};
  for (const id of expectedIds) {
    const name = input.assignments[id];
    if (typeof name !== "string" || !cleanLabel(name, 40)) throw new Error("Every castaway needs a valid tribe assignment");
    if (active.has(id)) {
      if (!currentNames.has(name)) throw new Error("Active castaways must belong to a current tribe");
    } else if (canMove.has(id)) {
      if (!currentNames.has(name) && name !== context.previousState.assignments[id]) {
        throw new Error("This episode's departures must retain their prior tribe or join a current tribe");
      }
    } else if (name !== context.previousState.assignments[id]) {
      throw new Error("An earlier departure's final tribe cannot be rewritten");
    }
    assignments[id] = name;
  }
  if (active.size && tribes.some(tribe => ![...active].some(id => assignments[id] === tribe.name))) {
    throw new Error("Every current tribe must contain at least one active castaway");
  }
  if (!Array.isArray(input.sources) || input.sources.length < 2 || input.sources.length > 10) {
    throw new Error("Provide an official source and an independent source");
  }
  const urls = input.sources.map(value => {
    if (typeof value !== "string" || value.length > 2000) throw new Error("Invalid tribe evidence URL");
    let url: URL;
    try { url = new URL(value); } catch { throw new Error("Invalid tribe evidence URL"); }
    if (url.protocol !== "https:" || url.username || url.password || !url.hostname.includes(".")) throw new Error("Tribe evidence must use public HTTPS URLs");
    return url;
  });
  if (!urls.some(url => isOfficial(url.hostname)) || !urls.some(url => !isOfficial(url.hostname))) {
    throw new Error("Tribe evidence needs CBS or Paramount plus an independent source");
  }
  return { afterEpisodeId: Number(input.afterEpisodeId), phase: expectedPhase, tribes, assignments, sources: [...new Set(urls.map(url => url.href))].sort() };
}

/** Immutable display overlay; departed castaways retain their recorded final tribe. */
export function applyTribeState<T extends { id: string; tribe: string }>(cast: readonly T[], state: TribeState): (T & { tribeHex: string })[] {
  const colors = new Map([...BASELINE_TRIBE_STATE.tribes, ...state.tribes].map(tribe => [tribe.name, tribe.hex]));
  return cast.map(castaway => {
    const tribe = state.assignments[castaway.id] || castaway.tribe;
    return { ...castaway, tribe, tribeHex: colors.get(tribe) || "#6b756d" };
  });
}

export function sameTribeState(a: TribeState, b: TribeState): boolean {
  const canonical = (state: TribeState) => JSON.stringify({
    afterEpisodeId: state.afterEpisodeId, phase: state.phase,
    tribes: [...state.tribes].sort((x, y) => x.name.localeCompare(y.name)).map(({ name, color, hex }) => ({ name, color, hex })),
    assignments: Object.fromEntries(Object.entries(state.assignments).sort(([x], [y]) => x.localeCompare(y))),
    sources: [...state.sources].sort(),
  });
  return canonical(a) === canonical(b);
}
