import { castaways } from "../app/data";
import { createAdminClient } from "../lib/supabase/admin";

function localParts(date:Date){const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Detroit",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(date);return Object.fromEntries(parts.map(p=>[p.type,p.value])) as Record<string,string>}
function detroitTimeToUtc(year:number,month:number,day:number,hour:number){const target=Date.UTC(year,month-1,day,hour);let guess=target;for(let i=0;i<3;i++){const p=localParts(new Date(guess));const shown=Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute),Number(p.second));guess+=target-shown}return new Date(guess)}
export function revealAtForAirTime(airAt:Date){const p=localParts(airAt),next=new Date(Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day)+1,9));return detroitTimeToUtc(next.getUTCFullYear(),next.getUTCMonth()+1,next.getUTCDate(),9).toISOString()}
export function isCastaway(id:string){return castaways.some(c=>c.id===id)}
export function isCommissioner(email:string){return (process.env.COMMISSIONER_EMAILS||"").toLowerCase().split(",").map(x=>x.trim()).includes(email.toLowerCase())}
export async function ensureDatabase(){const {error}=await createAdminClient().from("episodes").select("id").limit(1);if(error)throw error}

async function recomputePublishedScores(){
 const db=createAdminClient();
 const [{data:profiles,error:profileError},{data:episodes,error:episodeError},{data:picks,error:pickError},{data:results,error:resultError}]=await Promise.all([
  db.from("profiles").select("id,winner_pick").not("league_joined_at","is",null),
  db.from("episodes").select("id").eq("results_published",true).order("id"),
  db.from("picks").select("id,user_id,episode_id,favorite_point,immunity_point,boot_point,bonus_point,underdog_point,streak_point,double_point").order("episode_id"),
  db.from("episode_results").select("episode_id,finale_winner,finalists"),
 ]);
 if(profileError||episodeError||pickError||resultError)throw profileError||episodeError||pickError||resultError;
 const published=new Set((episodes||[]).map(e=>e.id));const finale=(results||[]).filter(r=>r.finale_winner&&published.has(r.episode_id)).sort((a,b)=>b.episode_id-a.episode_id)[0];
 for(const profile of profiles||[]){let total=0,streak=0,longest=0;const updatePromises=[];const userPicks=(picks||[]).filter(p=>p.user_id===profile.id&&published.has(p.episode_id));for(const pick of userPicks){streak=pick.immunity_point>0?streak+1:0;longest=Math.max(longest,streak);const streakPoint=streak>0&&streak%3===0?2:0;if(pick.streak_point!==streakPoint)updatePromises.push(db.from("picks").update({streak_point:streakPoint}).eq("id",pick.id));total+=pick.favorite_point+pick.immunity_point+pick.boot_point+pick.bonus_point+pick.underdog_point+streakPoint+pick.double_point}let preseason=0;if(finale){const finalists=Array.isArray(finale.finalists)?finale.finalists.map(String):[];preseason=profile.winner_pick===finale.finale_winner?10:finalists.includes(profile.winner_pick||"")?3:0}await Promise.all(updatePromises);const {error}=await db.from("profiles").update({total_points:total+preseason,preseason_points:preseason,immunity_streak:streak,longest_streak:longest,updated_at:new Date().toISOString()}).eq("id",profile.id);if(error)throw error}
}

export async function publishDueResults(now=new Date()){
 const db=createAdminClient();const {data:due,error}=await db.from("episodes").select("id").eq("results_posted",true).eq("results_published",false).lte("reveal_at",now.toISOString()).order("id");if(error)throw error;if(!due?.length)return 0;
 for(const episode of due){const {data:result,error:resultError}=await db.from("episode_results").select("departures").eq("episode_id",episode.id).single();if(resultError)throw resultError;const {error:updateError}=await db.from("episodes").update({results_published:true,updated_at:now.toISOString()}).eq("id",episode.id).eq("results_published",false);if(updateError)throw updateError;const departures=Array.isArray(result.departures)?result.departures as {castawayId?:string}[]:[];for(const departure of departures){if(departure.castawayId){const {error:statusError}=await db.from("cast_status").upsert({castaway_id:departure.castawayId,status:"eliminated",updated_at:now.toISOString()});if(statusError)throw statusError}}}
 await recomputePublishedScores();return due.length;
}
export async function refreshPublishedScores(){await recomputePublishedScores()}
