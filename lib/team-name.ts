export const TEAM_NAME_TAKEN = "That team name is already taken. Choose a different Survivor team name.";

export function normalizeTeamName(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export function isTeamNameConflict(error: { code?: string; message?: string } | null) {
  return error?.code === "23505" && Boolean(error.message?.includes("profiles_team_name_unique"));
}
