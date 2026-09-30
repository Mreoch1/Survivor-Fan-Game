import { getChatGPTUser } from "../app/chatgpt-auth";
import { isCommissioner } from "./runtime";
import { createAdminClient } from "../lib/supabase/admin";

export const popupHeaders = { "Cache-Control": "private, no-store" };
export const popupQuestionColumns = "id,question,details,credit_name,opens_at,closes_at,points,status,correct_answer,resolution_episode_id,reveal_at,created_at,created_by,resolved_at,resolved_by";
export function popupResponse(body: unknown, status = 200) { return Response.json(body, { status, headers: popupHeaders }); }
export function validPopupRequest(request: Request) {
  const origin = request.headers.get("origin");
  return request.headers.get("sec-fetch-site") !== "cross-site" &&
    (!origin || origin === `${new URL(request.url).protocol}//${request.headers.get("host") || new URL(request.url).host}`) &&
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() === "application/json";
}
export async function popupMember(commissioner = false) {
  const user = await getChatGPTUser();
  if (!user) return { response: popupResponse({ error: "Sign in to see bonus questions" }, 401) };
  if (commissioner && !isCommissioner(user.email)) return { response: popupResponse({ error: "Commissioner access required" }, 403) };
  const db = createAdminClient();
  const { data: profile, error } = await db.from("profiles").select("league_joined_at").eq("id", user.userId).maybeSingle();
  if (error) throw error;
  if (!profile?.league_joined_at) return { response: popupResponse({ error: "Join the league before answering bonus questions" }, 403) };
  return { user, db };
}
