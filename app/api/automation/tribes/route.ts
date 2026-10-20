import { loadTribeContext, saveTribeState } from "../../../../db/tribes";

function authorized(request: Request) {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const expected = process.env.AUTO_RESULTS_SECRET || "";
  if (!supplied || !expected || supplied.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < supplied.length; index += 1) difference |= supplied.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function GET(request: Request) {
  if (!authorized(request)) return json({ error: "Automation access required" }, 401);
  const context = await loadTribeContext();
  return json({
    ...context,
    pending: Boolean(context.target && !context.existingSnapshot),
    rules: {
      scope: "Verify tribe names, colors and all cast assignments after every published episode, even when the roster did not change.",
      evidence: "Use aired CBS/Paramount evidence and an independent detailed recap. Each source must support the full roster; no previews, rumors or unaired outcomes.",
      phase: "Use individual only after individual_game_started is explicitly recorded in published results. A swap alone does not start the individual game.",
      history: "Every exact cast ID is required. Preserve final tribes for earlier departures; this episode's departures may move with its swap.",
      immutable: "One snapshot per episode. Repeating the same payload succeeds without rewriting it; a conflicting snapshot requires commissioner review.",
      submit: "POST the full TribeState plus expectedPreviousAfterEpisodeId from this context. Refetch context immediately before submitting.",
    },
    payloadExample: context.target ? {
      ...(context.existingSnapshot || context.previousSnapshot),
      afterEpisodeId: context.target.afterEpisodeId,
      phase: context.target.individualGameStarted ? "individual" : "tribe",
      expectedPreviousAfterEpisodeId: context.expectedPreviousAfterEpisodeId,
      sources: ["https://www.paramountplus.com/REPLACE-WITH-VERIFIED-AIRED-EPISODE-SOURCE", "https://independent-recap.example/REPLACE-WITH-VERIFIED-RECAP"],
    } : null,
  });
}

export async function POST(request: Request) {
  if (!authorized(request)) return json({ error: "Automation access required" }, 401);
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "Provide a JSON tribe snapshot" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Provide a JSON tribe snapshot" }, 400);
  const result = await saveTribeState(body, (body as { expectedPreviousAfterEpisodeId?: unknown }).expectedPreviousAfterEpisodeId);
  return result.ok ? json({ ...result, saved: true, verified: true }) : json({ error: result.error }, result.status);
}
