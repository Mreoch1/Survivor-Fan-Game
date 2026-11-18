import { isQuestionId, WEEKLY_POPUP_POINTS } from "./popup-questions";

export const WEEKLY_POPUP_FIRST_EPISODE = 10;
export const WEEKLY_POPUP_OPTIONS = ["Yes", "No"] as const;

export function normalizePopupQuestion(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function validSource(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function isOfficialSource(url: URL) {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  return host === "cbs.com" || host.endsWith(".cbs.com") || host === "paramountplus.com" ||
    host.endsWith(".paramountplus.com") || host === "paramountpressexpress.com" || host.endsWith(".paramountpressexpress.com");
}

export function parseWeeklyPopupDraft(body: Record<string, unknown>, episodeId: number) {
  const id = typeof body.id === "string" ? body.id : "";
  const question = typeof body.question === "string" ? body.question.trim() : "";
  const details = typeof body.details === "string" ? body.details.trim() : "";
  const sources = Array.isArray(body.sources) ? body.sources.map(validSource) : [];
  const validSources = sources.filter((source): source is URL => Boolean(source));
  const sourceHosts = new Set(validSources.map(source => source.hostname.toLowerCase().replace(/^www\./, "")));
  if (!isQuestionId(id) || !Number.isInteger(episodeId) || episodeId < WEEKLY_POPUP_FIRST_EPISODE ||
    !question.startsWith(`During Episode ${episodeId},`) || question.length > 140 ||
    !details || details.length > 2000 || validSources.length !== sources.length || sourceHosts.size < 2 ||
    !validSources.some(isOfficialSource)) return null;
  return { id, question, details, points: WEEKLY_POPUP_POINTS, sources: validSources.map(source => source.toString()) };
}

export function sameWeeklyPopup(saved: {
  id: string; question: string; details: string; points: number; target_episode_id?: number | null; closes_at: string;
}, draft: { id: string; question: string; details: string; points: number }, episodeId: number, lockAt: string) {
  return saved.id === draft.id && saved.question === draft.question && saved.details === draft.details &&
    saved.points === draft.points && saved.target_episode_id === episodeId &&
    new Date(saved.closes_at).getTime() === new Date(lockAt).getTime();
}

export function weeklyPopupTargetError(target: { id: number; lock_at: string } | null | undefined, episodeId: number, now = new Date()) {
  if (!target || target.id !== episodeId || episodeId < WEEKLY_POPUP_FIRST_EPISODE) return "The exact eligible upcoming episode is required";
  if (new Date(target.lock_at) <= now) return "The upcoming episode's pick deadline has passed";
  return null;
}

export function duplicatesWeeklyPopup(question: string, otherQuestions: unknown[]) {
  const normalized = normalizePopupQuestion(question);
  return otherQuestions.some(value => normalizePopupQuestion(String(value || "")) === normalized);
}
