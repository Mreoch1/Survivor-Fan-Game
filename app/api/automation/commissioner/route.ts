import { createAdminClient } from "../../../../lib/supabase/admin";
import { ensureDatabase, publishDueResults } from "../../../../db/runtime";
import { scheduleEpisode } from "../../../../db/schedule";

function authorized(request: Request) {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const expected = process.env.AUTO_RESULTS_SECRET || "";
  if (!supplied || !expected || supplied.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < supplied.length; index += 1) {
    difference |= supplied.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "Automation access required" }, { status: 401 });
  }

  await ensureDatabase();
  await publishDueResults();
  const db = createAdminClient();
  const [{ data: open }, { data: latest }, { data: individualGameEpisode }] = await Promise.all([
    db
      .from("episodes")
      .select("id,title,air_at,lock_at,phase,bonus_question,bonus_options")
      .eq("results_posted", false)
      .order("id")
      .limit(1)
      .maybeSingle(),
    db
      .from("episodes")
      .select("id,title,air_at,phase,bonus_question,bonus_options,results_posted,individual_game_started")
      .order("id", { ascending: false })
      .limit(6),
    db
      .from("episodes")
      .select("id")
      .eq("individual_game_started", true)
      .limit(1)
      .maybeSingle(),
  ]);

  const maxId = (latest || []).reduce((value, row) => Math.max(value, row.id), 0);
  const lastAirAt = latest?.[0]?.air_at || null;
  const suggestedAirAt = lastAirAt
    ? new Date(new Date(lastAirAt).getTime() + 7 * 86400000).toISOString()
    : "2026-09-24T00:00:00.000Z";
  const individualGameRecorded = Boolean(individualGameEpisode);

  return Response.json({
    target: open
      ? {
          id: open.id,
          title: open.title,
          airAt: open.air_at,
          lockAt: open.lock_at,
          phase: open.phase,
          bonusQuestion: open.bonus_question,
          bonusOptions: open.bonus_options,
          existing: true,
        }
      : { id: maxId + 1, suggestedAirAt, existing: false },
    recentEpisodes: (latest || []).map((row) => ({
      id: row.id,
      title: row.title,
      airAt: row.air_at,
      phase: row.phase,
      bonusQuestion: row.bonus_question,
      bonusOptions: row.bonus_options,
      resultsPosted: row.results_posted,
      individualGameStarted: row.individual_game_started,
    })),
    rules: {
      scheduleSource: "Verify CBS, Paramount, or Paramount Press Express first",
      lock: "One hour before airtime",
      reveal: "9:00 AM America/Detroit the next morning",
      phaseValues: ["tribe", "individual"],
      phaseRule: individualGameRecorded
        ? "The individual game has been confirmed; schedule individual immunity picks."
        : "Keep tribe immunity unless the individual game was confirmed in an aired episode. Do not guess the transition.",
      bonusOptions: "Two to four short, mutually exclusive choices",
      freeze: "Do not change phase or bonus choices after any player picks exist",
    },
  });
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "Automation access required" }, { status: 401 });
  }
  const body = (await request.json()) as {
    episodeId?: number;
    title?: string;
    airAt?: string;
    phase?: "tribe" | "individual";
    bonusQuestion?: string;
    bonusOptions?: string[];
  };
  const result = await scheduleEpisode({
    episodeId: Number(body.episodeId),
    title: String(body.title || ""),
    airAt: String(body.airAt || ""),
    phase: body.phase === "individual" ? "individual" : "tribe",
    bonusQuestion: String(body.bonusQuestion || ""),
    bonusOptions: Array.isArray(body.bonusOptions) ? body.bonusOptions : [],
  });
  return result.ok
    ? Response.json({ ...result, scheduled: true })
    : Response.json({ error: result.error }, { status: result.status });
}
