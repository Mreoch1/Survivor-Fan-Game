import { createAdminClient } from "../lib/supabase/admin";
import { isCastaway, publishDueResults } from "./runtime";
import { carryForwardPicks } from "./pick-carryover";
import { castaways } from "../app/data";
import { loadTribeState } from "./tribes";
import { validateTribeState } from "../lib/tribes";
import { scorePick } from "../lib/scoring";

export type Departure={castawayId:string;type:"vote"|"medical"|"quit"};
export type EpisodeResult={episodeId:number;departures:Departure[];immunityWinners:string[];bonusAnswer:string;voidBonusQuestion?:boolean;individualGameStarted?:boolean;tribeState?:unknown};

export async function recordEpisodeResults(input:EpisodeResult){
 const bonusVoid=input.voidBonusQuestion===true;
 if(bonusVoid&&input.bonusAnswer!=="")return{ok:false as const,status:400,error:"Choose an answer or void the question, not both"};
 const bonusAnswer=bonusVoid?"":input.bonusAnswer;
 const db=createAdminClient();
 const previousTribes=await loadTribeState(input.episodeId);
 let outcomeTribes=previousTribes;
 if(input.tribeState){
  const {data:statuses,error:statusError}=await db.from("cast_status").select("castaway_id,status");
  if(statusError)throw statusError;
  const departed=new Set((statuses||[]).filter(row=>row.status==="eliminated").map(row=>row.castaway_id));
  for(const departure of input.departures)departed.add(departure.castawayId);
  try{
   outcomeTribes=validateTribeState(input.tribeState,{castIds:castaways.map(c=>c.id),previousState:previousTribes,activeCastIds:castaways.filter(c=>!departed.has(c.id)).map(c=>c.id),latestDepartureIds:input.departures.map(d=>d.castawayId),individualGameStarted:previousTribes.phase==="individual"||Boolean(input.individualGameStarted)});
   if(outcomeTribes.afterEpisodeId!==input.episodeId)throw new Error("The roster must match the episode being scored");
  }catch(error){return{ok:false as const,status:400,error:error instanceof Error?error.message:"Invalid episode tribe roster"}}
 }
 const tribeNames=new Set([...previousTribes.tribes,...outcomeTribes.tribes].map(tribe=>tribe.name));
 const departures=input.departures.filter((d,i,a)=>isCastaway(d.castawayId)&&["vote","medical","quit"].includes(d.type)&&a.findIndex(x=>x.castawayId===d.castawayId)===i),immunityWinners=[...new Set(input.immunityWinners.filter(x=>isCastaway(x)||tribeNames.has(x)))];
 if(!input.episodeId||departures.length!==input.departures.length||immunityWinners.length!==input.immunityWinners.length)return{ok:false as const,status:400,error:"One or more episode outcomes are invalid"};
 const {data:episode}=await db.from("episodes").select("id,phase,bonus_options,reveal_at").eq("id",input.episodeId).eq("results_posted",false).maybeSingle();if(!episode)return{ok:false as const,status:409,error:"That episode is already scored or missing"};const options=Array.isArray(episode.bonus_options)?episode.bonus_options.map(String):[];if(!bonusVoid&&(!bonusAnswer||!options.includes(bonusAnswer)))return{ok:false as const,status:400,error:"That bonus result is not valid"};
 if(input.individualGameStarted){const {data:prior}=await db.from("episodes").select("id").eq("individual_game_started",true).neq("id",input.episodeId).limit(1);if(prior?.length)return{ok:false as const,status:409,error:"The individual game has already been recorded"}}
 await carryForwardPicks(input.episodeId);const immunityVoid=!immunityWinners.length||(episode.phase==="tribe"?immunityWinners.some(isCastaway):immunityWinners.some(x=>tribeNames.has(x))),voted=new Set(departures.filter(d=>d.type==="vote").map(d=>d.castawayId)),departed=new Set(departures.map(d=>d.castawayId));const {data:rows,error:pickError}=await db.from("picks").select("id,favorite_id,immunity_pick,boot_pick,bonus_pick,double_down").eq("episode_id",input.episodeId);if(pickError)throw pickError;const validFavorites=(rows||[]).filter(row=>isCastaway(row.favorite_id)),total=validFavorites.length,favoriteCounts=new Map<string,number>();for(const row of validFavorites)favoriteCounts.set(row.favorite_id,(favoriteCounts.get(row.favorite_id)||0)+1);
 for(const row of rows||[]){const score=scorePick({favoriteId:isCastaway(row.favorite_id)?row.favorite_id:"",immunityPick:row.immunity_pick,bootPick:row.boot_pick,bonusPick:row.bonus_pick,doubleDown:row.double_down,voted,departed,immunityWinners,bonusAnswer,immunityVoid,favoriteShare:total?((favoriteCounts.get(row.favorite_id)||0)/total):1});const {error}=await db.from("picks").update({favorite_point:score.favorite,immunity_point:score.immunity,boot_point:score.boot,bonus_point:score.bonus,underdog_point:score.underdog,streak_point:0,double_point:score.doublePoint}).eq("id",row.id);if(error)throw error}
 const {error:resultError}=await db.from("episode_results").upsert({episode_id:input.episodeId,departures,immunity_winners:immunityWinners,immunity_void:immunityVoid,bonus_answer:bonusAnswer,recorded_at:new Date().toISOString()});if(resultError)throw resultError;const {error:episodeError}=await db.from("episodes").update({results_posted:true,results_published:false,individual_game_started:Boolean(input.individualGameStarted),updated_at:new Date().toISOString()}).eq("id",input.episodeId);if(episodeError)throw episodeError;const published=await publishDueResults();return{ok:true as const,revealAt:episode.reveal_at,published:published>0,immunityVoid,bonusVoid,individualGameStarted:Boolean(input.individualGameStarted)};
}
