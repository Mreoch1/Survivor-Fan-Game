export type PickChoices = {
  favoriteId?: string | null;
  immunityPick?: string | null;
  bootPick?: string | null;
  individualGamePick?: string | null;
};

export type WeeklyPickDraft = {
  favoriteId: string;
  immunityPick: string;
  bootPick: string;
  bonusPick: string;
  shotInTheDark: string;
  individualGamePick: string;
};

export type SavedWeeklyPick = Omit<WeeklyPickDraft, "individualGamePick"> & {
  carriedFromEpisodeId: number | null;
  updatedAt: string;
};

export function getPickCompletion(pick: PickChoices, openingRequired = false) {
  const items = [
    { id: "weekly-favorite", label: "Weekly Favorite", selected: Boolean(pick.favoriteId) },
    { id: "weekly-immunity", label: "Immunity", selected: Boolean(pick.immunityPick) },
    { id: "weekly-vote-out", label: "Vote-Out", selected: Boolean(pick.bootPick) },
    ...(openingRequired ? [{ id: "opening-outlast-pick", label: "Opening Outlast", selected: Boolean(pick.individualGamePick) }] : []),
  ];
  const missing = items.filter(item => !item.selected);
  return { items, missing, selectedCount: items.length - missing.length, total: items.length, complete: missing.length === 0 };
}

export function isPickDirty(draft: WeeklyPickDraft, saved: SavedWeeklyPick | null | undefined, openingPick: string, openingRequired: boolean) {
  return !saved || draft.favoriteId !== saved.favoriteId || draft.immunityPick !== saved.immunityPick ||
    draft.bootPick !== saved.bootPick || draft.bonusPick !== saved.bonusPick || draft.shotInTheDark !== saved.shotInTheDark ||
    (openingRequired && draft.individualGamePick !== openingPick);
}

export function getPickSaveState(draft: WeeklyPickDraft, saved: SavedWeeklyPick | null | undefined, openingPick: string, openingRequired: boolean) {
  if (!getPickCompletion(draft, openingRequired).complete) return "missing";
  if (isPickDirty(draft, saved, openingPick, openingRequired)) return "unsaved";
  return saved?.carriedFromEpisodeId ? "carried" : "saved";
}

type SaveResult = { ok: true; updatedAt: string; castawayId?: string; switched?: boolean };

// A success label requires the server's save receipt, never a client-generated timestamp.
export async function savePickRequest(path: "/api/picks" | "/api/endgame-pick", payload: object, fetcher: typeof fetch = fetch): Promise<SaveResult> {
  let response: Response;
  try {
    response = await fetcher(path, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  } catch {
    throw new Error("Couldn’t save. Check your connection and try again. Your selections are still here.");
  }
  const body = await response.json().catch(() => null) as (Partial<SaveResult> & { error?: string }) | null;
  if (!response.ok) throw new Error(body?.error || "Picks were not saved. Please try again.");
  if (body?.ok !== true || typeof body.updatedAt !== "string" || !Number.isFinite(Date.parse(body.updatedAt))) {
    throw new Error("Couldn’t confirm the save. Your selections are still here; try saving again.");
  }
  return body as SaveResult;
}
