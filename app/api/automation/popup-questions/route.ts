import { createAdminClient } from "../../../../lib/supabase/admin";
import { popupQuestionColumns } from "../../../../db/popup-questions";
import { ensureDatabase, publishDueResults, refreshPublishedScores } from "../../../../db/runtime";
import { type PopupQuestion } from "../../../../lib/popup-questions";
import { duplicatesWeeklyPopup, parseWeeklyPopupDraft, sameWeeklyPopup, weeklyPopupTargetError, WEEKLY_POPUP_FIRST_EPISODE, WEEKLY_POPUP_OPTIONS } from "../../../../lib/weekly-popup-question";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

function authorized(request: Request) {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const expected = process.env.AUTO_RESULTS_SECRET || "";
  if (!supplied || !expected || supplied.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < supplied.length; index += 1) difference |= supplied.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}

async function commissionerActor() {
  const db = createAdminClient();
  const allowed = new Set((process.env.COMMISSIONER_EMAILS || "").toLowerCase().split(",").map(value => value.trim()).filter(Boolean));
  const { data: users, error: userError } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (userError) throw userError;
  const ids = users.users.filter(user => user.email && allowed.has(user.email.toLowerCase())).map(user => user.id).sort();
  if (!ids.length) throw new Error("No commissioner account is configured");
  const { data: profiles, error: profileError } = await db.from("profiles").select("id,league_joined_at").in("id", ids).not("league_joined_at", "is", null);
  if (profileError) throw profileError;
  const actor = ids.find(id => profiles?.some(profile => profile.id === id));
  if (!actor) throw new Error("No joined commissioner account is available");
  return actor;
}

async function loadState() {
  const db = createAdminClient();
  const [{ data: episodes, error: episodeError }, { data: questions, error: questionError }] = await Promise.all([
    db.from("episodes").select("id,title,air_at,lock_at,reveal_at,phase,bonus_question,bonus_options,results_posted,results_published").eq("season", 51).order("id"),
    db.from("popup_questions").select(popupQuestionColumns).order("created_at", { ascending: false }).order("id"),
  ]);
  if (episodeError || questionError) throw episodeError || questionError;
  return { db, episodes: episodes || [], questions: (questions || []) as PopupQuestion[] };
}

export async function GET(request: Request) {
  if (!authorized(request)) return json({ error: "Automation access required" }, 401);
  try {
    await ensureDatabase();
    await publishDueResults();
    const { episodes, questions } = await loadState();
    const now = new Date();
    const target = episodes.find(episode => !episode.results_posted) || null;
    const existing = target ? questions.find(question => question.target_episode_id === target.id) || null : null;
    const pendingResolution = questions
      .filter(question => question.target_episode_id && question.status === "open" && new Date(question.closes_at) <= now &&
        episodes.some(episode => episode.id === question.target_episode_id && episode.results_posted))
      .sort((left, right) => Number(left.target_episode_id) - Number(right.target_episode_id))[0] || null;
    return json({
      target: target ? { id: target.id, title: target.title, airAt: target.air_at, lockAt: target.lock_at,
        revealAt: target.reveal_at, phase: target.phase, playYourAdvantageQuestion: target.bonus_question,
        playYourAdvantageOptions: target.bonus_options, eligible: target.id >= WEEKLY_POPUP_FIRST_EPISODE } : null,
      existingQuestion: existing,
      pendingResolution: pendingResolution ? { id: pendingResolution.id, episodeId: pendingResolution.target_episode_id,
        question: pendingResolution.question, details: pendingResolution.details, closesAt: pendingResolution.closes_at,
        points: pendingResolution.points, status: pendingResolution.status } : null,
      recentQuestions: questions.slice(0, 8).map(question => ({ episodeId: question.target_episode_id, question: question.question,
        details: question.details, points: question.points, status: question.status })),
      rules: {
        firstEpisode: WEEKLY_POPUP_FIRST_EPISODE,
        points: { correct: 5, incorrect: 0, skipped: 0 },
        options: WEEKLY_POPUP_OPTIONS,
        window: "Open when created after the Monday turnover and close exactly at that episode's weekly-pick lock.",
        question: "Use one objective Yes/No event from official previews for the exact upcoming episode. Begin 'During Episode N,' and keep the displayed question within 140 characters.",
        precision: "Put every inclusion, exclusion, timing, location, attempt, play, success, and Shot in the Dark condition that can change the answer in the player-visible question or details.",
        distinction: "This is separate from Play Your Advantage. Do not reuse or closely paraphrase that episode's Play Your Advantage question or a recent popup question.",
        evidence: "Use an official CBS, Paramount+, or Paramount Press Express preview plus a second independent reputable source. Never use leaks, rumors, boot lists, or unaired outcomes.",
        resolution: "Resolve only from the aired episode using authoritative material plus an independent detailed recap. If reasonable readings differ, do not guess; leave it unresolved for commissioner review.",
      },
    });
  } catch {
    return json({ error: "Weekly bonus question context could not be verified" }, 503);
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) return json({ error: "Automation access required" }, 401);
  try {
    await ensureDatabase();
    await publishDueResults();
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || Array.isArray(body)) return json({ error: "A weekly bonus question action is required" }, 400);
    const { db, episodes, questions } = await loadState();
    if (body.action === "create") {
      const target = episodes.find(episode => !episode.results_posted);
      const episodeId = Number(body.episodeId);
      const targetError = weeklyPopupTargetError(target, episodeId);
      if (targetError) return json({ error: targetError }, 409);
      if (!target) return json({ error: "The exact eligible upcoming episode is required" }, 409);
      const draft = parseWeeklyPopupDraft(body, episodeId);
      if (!draft) return json({ error: "Provide a precise Episode-linked Yes/No question, details, and two distinct HTTPS sources including an official source" }, 400);
      const duplicateCandidates = [target.bonus_question, ...questions.filter(question => question.target_episode_id !== episodeId).slice(0, 8).map(question => question.question)];
      if (duplicatesWeeklyPopup(draft.question, duplicateCandidates)) return json({ error: "The weekly popup question duplicates Play Your Advantage or a recent popup question" }, 409);
      let saved = questions.find(question => question.target_episode_id === episodeId) || null;
      if (!saved) {
        const actor = await commissionerActor();
        const { error } = await db.from("popup_questions").insert({ id: draft.id, question: draft.question, details: draft.details,
          credit_name: "", opens_at: new Date().toISOString(), closes_at: target.lock_at, points: draft.points,
          target_episode_id: episodeId, created_by: actor });
        if (error && error.code !== "23505") throw error;
        const { data, error: readError } = await db.from("popup_questions").select(popupQuestionColumns).eq("target_episode_id", episodeId).maybeSingle();
        if (readError) throw readError;
        saved = data as PopupQuestion | null;
      }
      if (!saved || !sameWeeklyPopup(saved, draft, episodeId, target.lock_at)) return json({ error: "A different weekly popup question already exists for this episode" }, 409);
      return json({ created: true, alreadyCreated: questions.some(question => question.target_episode_id === episodeId), question: saved });
    }
    if (body.action === "resolve") {
      const questionId = String(body.questionId || ""), episodeId = Number(body.episodeId), answer = String(body.answer || "");
      const question = questions.find(item => item.id === questionId && item.target_episode_id === episodeId);
      const episode = episodes.find(item => item.id === episodeId);
      if (!question || !episode || !episode.results_posted || !["Yes", "No", "Void"].includes(answer)) return json({ error: "The exact closed question, posted episode, and official answer are required" }, 409);
      if (new Date(question.closes_at) > new Date()) return json({ error: "Voting must close before the weekly question is resolved" }, 409);
      const actor = await commissionerActor();
      const { data, error } = await db.rpc("resolve_popup_question", { p_question_id: questionId, p_actor_id: actor,
        p_answer: answer, p_episode_id: episodeId });
      if (error || !data) throw error || new Error("Missing resolution receipt");
      if (!data.ok) return json(data, data.status || 409);
      await refreshPublishedScores();
      return json({ ...data, resolved: true });
    }
    return json({ error: "Choose create or resolve" }, 400);
  } catch {
    return json({ error: "The weekly bonus question change could not be confirmed. Refetch context before retrying the same action." }, 503);
  }
}
