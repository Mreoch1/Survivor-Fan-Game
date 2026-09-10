export type UnreadCounts = { campfire: number; messages: number };
export const NOTIFICATIONS_CHANGED = "outlast-notifications-changed";

export function validReadThrough(value: unknown, now = Date.now()): value is string {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= now && timestamp > 0;
}
