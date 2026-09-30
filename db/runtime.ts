import { castaways } from "../app/data";
import { createAdminClient } from "../lib/supabase/admin";
import { applyImmunityStreak, scoreSeasonPick } from "../lib/scoring";
import { buildPopupScoreLedger, popupPointsAt } from "../lib/popup-score-ledger";
import { loadPopupScores } from "./popup-scores";

function localParts(date:Date){const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Detroit",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(date);return Object.fromEntries(parts.map(p=>[p.type,p.value])) as Record<string,string>}
function detroitTimeToUtc(year:number,month:number,day:number,hour:number,minute=0){const target=Date.UTC(year,month-1,day,hour,minute);let guess=target;for(let i=0;i<3;i++){const p=localParts(new Date(guess));const shown=Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute),Number(p.second));guess+=target-shown}return new Date(guess)}
export function revealAtForAirTime(airAt:Date){
 const p=localParts(airAt),airDate=new Date(Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day)));
 // Use the local air date; a Monday episode reveals the following Monday.
 const daysUntilMonday=(8-airDate.getUTCDay())%7||7;
 airDate.setUTCDate(airDate.getUTCDate()+daysUntilMonday);
 return detroitTimeToUtc(airDate.getUTCFullYear(),airDate.getUTCMonth()+1,airDate.getUTCDate(),6,30).toISOString();
}
export function isCastaway(id:string){return castaways.some(c=>c.id===id)}
export function isCommissioner(email:string){return (process.env.COMMISSIONER_EMAILS||"").toLowerCase().split(",").map(x=>x.trim()).includes(email.toLowerCase())}
export async function ensureDatabase(){const {error}=await createAdminClient().from("episodes").select("id").limit(1);if(error)throw error}

async function recomputePublishedScores(now = new Date()) {
 const db = createAdminClient();
 const [{ data: profiles, error: profileError }, { data: episodes, error: episodeError }, { data: picks, error: pickError }, { data: results, error: resultError }] = await Promise.all([
  db.from("profiles").select("id,individual_game_pick,endgame_pick,endgame_pick_switched,total_points,preseason_points,individual_game_points,endgame_points,immunity_streak,longest_streak").not("league_joined_at", "is", null),
  db.from("episodes").select("id,individual_game_started,results_published,reveal_at").eq("results_published", true).lte("reveal_at", now.toISOString()).order("id"),
  db.from("picks").select("id,user_id,episode_id,favorite_point,immunity_point,boot_point,bonus_point,underdog_point,streak_point,double_point").order("episode_id"),
  db.from("episode_results").select("episode_id,departures,immunity_void,finale_winner,finalists"),
 ]);
 if (profileError || episodeError || pickError || resultError) throw profileError || episodeError || pickError || resultError;
 const { popupQuestions, popupVotes } = await loadPopupScores(episodes || [], now, db);
 const popupLedger = buildPopupScoreLedger(popupQuestions, popupVotes, episodes || [], now);
 const published = new Set((episodes || []).map(episode => episode.id));
 const resultByEpisode = new Map((results || []).map(result => [result.episode_id, result]));
 const individualEpisode = (episodes || []).find(episode => episode.individual_game_started);
 const departedBeforeIndividual = new Set<string>();
 if (individualEpisode) {
  for (const result of results || []) {
   if (result.episode_id >= individualEpisode.id || !published.has(result.episode_id)) continue;
   const departures = Array.isArray(result.departures) ? result.departures as { castawayId?: string }[] : [];
   for (const departure of departures) if (departure.castawayId) departedBeforeIndividual.add(departure.castawayId);
  }
 }
 const finale = (results || []).filter(result => result.finale_winner && published.has(result.episode_id)).sort((a, b) => b.episode_id - a.episode_id)[0];
 for (const profile of profiles || []) {
  let weeklyTotal = 0, streak = 0, longest = 0;
  const updatePromises = [];
  const userPicks = (picks || []).filter(pick => pick.user_id === profile.id && published.has(pick.episode_id));
  for (const pick of userPicks) {
   const next = applyImmunityStreak(streak, pick.immunity_point, Boolean(resultByEpisode.get(pick.episode_id)?.immunity_void));
   streak = next.streak;
   longest = Math.max(longest, streak);
   if (pick.streak_point !== next.bonus) updatePromises.push(db.from("picks").update({ streak_point: next.bonus }).eq("id", pick.id));
   weeklyTotal += pick.favorite_point + pick.immunity_point + pick.boot_point + pick.bonus_point + pick.underdog_point + next.bonus + pick.double_point;
  }
  const original = profile.individual_game_pick || "";
  const reached = Boolean(individualEpisode && original && !departedBeforeIndividual.has(original));
  const endgame = profile.endgame_pick || (reached ? original : "");
  const season = scoreSeasonPick({ individualGamePick: original, endgamePick: endgame, endgamePickSwitched: Boolean(profile.endgame_pick_switched), departedBeforeIndividual, individualGameStarted: Boolean(individualEpisode), finaleWinner: String(finale?.finale_winner || ""), finalists: Array.isArray(finale?.finalists) ? finale.finalists.map(String) : [] });
  const streakUpdates = await Promise.all(updatePromises);
  for (const update of streakUpdates) if (update.error) throw update.error;
  const scoreFields = { total_points: weeklyTotal + season.total + popupPointsAt(popupLedger, profile.id, now), preseason_points: season.total, individual_game_points: season.individualGamePoints, endgame_points: season.endgamePoints, immunity_streak: streak, longest_streak: longest };
  // Popup reveals can refresh without a new episode; repeated reads must not churn profile timestamps.
  if (Object.entries(scoreFields).every(([key, value]) => Number(profile[key as keyof typeof scoreFields] || 0) === value)) continue;
  const { error } = await db.from("profiles").update({ ...scoreFields, updated_at: now.toISOString() }).eq("id", profile.id);
  if (error) throw error;
 }
}

async function initializeEndgamePicks(episodeId:number){
 const db=createAdminClient();const [{data:profiles,error:profileError},{data:priorResults,error:resultError}]=await Promise.all([db.from("profiles").select("id,individual_game_pick,endgame_pick").not("league_joined_at","is",null),db.from("episode_results").select("departures").lt("episode_id",episodeId)]);if(profileError||resultError)throw profileError||resultError;const departed=new Set<string>();for(const result of priorResults||[]){const rows=Array.isArray(result.departures)?result.departures as {castawayId?:string}[]:[];for(const row of rows)if(row.castawayId)departed.add(row.castawayId)}
 for(const profile of profiles||[]){const original=profile.individual_game_pick||"",reached=Boolean(original&&!departed.has(original)),update:Record<string,unknown>={individual_game_points:reached?10:0,updated_at:new Date().toISOString()};if(reached&&!profile.endgame_pick){update.endgame_pick=original;update.endgame_pick_switched=false}const {error}=await db.from("profiles").update(update).eq("id",profile.id);if(error)throw error}
}

export async function publishDueResults(now=new Date()){
 const db=createAdminClient();const {data:due,error}=await db.from("episodes").select("id,individual_game_started").eq("results_posted",true).eq("results_published",false).lte("reveal_at",now.toISOString()).order("id");if(error)throw error;
 if(!due?.length){
  const {data:popup,error:popupError}=await db.from("popup_questions").select("id").in("status",["resolved","void"]).not("resolution_episode_id","is",null).lte("reveal_at",now.toISOString()).limit(1).maybeSingle();
  if(popupError)throw popupError;
  if(popup)await recomputePublishedScores(now);
  return 0;
 }
 for(const episode of due){const {data:result,error:resultError}=await db.from("episode_results").select("departures").eq("episode_id",episode.id).single();if(resultError)throw resultError;const {error:updateError}=await db.from("episodes").update({results_published:true,updated_at:now.toISOString()}).eq("id",episode.id).eq("results_published",false);if(updateError)throw updateError;if(episode.individual_game_started)await initializeEndgamePicks(episode.id);const departures=Array.isArray(result.departures)?result.departures as {castawayId?:string}[]:[];for(const departure of departures){if(departure.castawayId){const {error:statusError}=await db.from("cast_status").upsert({castaway_id:departure.castawayId,status:"eliminated",updated_at:now.toISOString()});if(statusError)throw statusError}}}
 await recomputePublishedScores(now);return due.length;
}
export async function refreshPublishedScores(now=new Date()){await recomputePublishedScores(now)}
