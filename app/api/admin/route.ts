import { getChatGPTUser } from "../../chatgpt-auth";
import { castaways } from "../../data";
import { createAdminClient } from "../../../lib/supabase/admin";
import { ensureDatabase,isCastaway,isCommissioner,publishDueResults,refreshPublishedScores } from "../../../db/runtime";
import { recordEpisodeResults } from "../../../db/results";
import { scheduleEpisode } from "../../../db/schedule";

async function authorize(){const user=await getChatGPTUser();return user&&isCommissioner(user.email)?user:null}
export async function GET(){if(!await authorize())return Response.json({error:"Commissioner access required"},{status:403});await ensureDatabase();await publishDueResults();const {data}=await createAdminClient().from("episodes").select("id,title,air_at,lock_at,reveal_at,phase,bonus_question,bonus_options,results_posted,results_published,individual_game_started").order("id");return Response.json({episodes:(data||[]).map(e=>({id:e.id,title:e.title,airAt:e.air_at,lockAt:e.lock_at,revealAt:e.reveal_at,phase:e.phase,bonusQuestion:e.bonus_question,bonusOptions:JSON.stringify(e.bonus_options),resultsPosted:e.results_posted?1:0,resultsPublished:e.results_published?1:0,individualGameStarted:Boolean(e.individual_game_started)})),castaways:castaways.map(c=>({id:c.id,name:c.name,tribe:c.tribe}))})}

export async function POST(request:Request){
 if(!await authorize())return Response.json({error:"Commissioner access required"},{status:403});await ensureDatabase();const body=await request.json() as Record<string,unknown>;
 if(body.action==="schedule"){const result=await scheduleEpisode({episodeId:Number(body.episodeId),title:String(body.title||""),airAt:String(body.airAt||""),phase:body.phase==="individual"?"individual":"tribe",bonusQuestion:String(body.bonusQuestion||""),bonusOptions:String(body.bonusOptions||"").split("|")});return result.ok?Response.json(result):Response.json({error:result.error},{status:result.status})}
 if(body.action==="results"){const result=await recordEpisodeResults({episodeId:Number(body.episodeId),departures:[{castawayId:String(body.booted||""),type:"vote"}],immunityWinners:[String(body.immunityWinner||"")],bonusAnswer:String(body.bonusAnswer||""),individualGameStarted:body.individualGameStarted==="on"});return result.ok?Response.json(result):Response.json({error:result.error},{status:result.status})}
 if(body.action==="finale"){
  const episodeId=Number(body.episodeId),winner=String(body.winner||""),finalists=[String(body.finalist2||""),String(body.finalist3||"")].filter(Boolean);if(!episodeId||!isCastaway(winner)||finalists.length!==2||finalists.some(x=>!isCastaway(x)))return Response.json({error:"Choose the finale episode, winner, and finalists"},{status:400});const db=createAdminClient(),{data:episode}=await db.from("episodes").select("reveal_at").eq("id",episodeId).maybeSingle();if(!episode)return Response.json({error:"That finale episode is missing"},{status:404});const {data:result}=await db.from("episode_results").select("episode_id").eq("episode_id",episodeId).maybeSingle();if(!result)return Response.json({error:"Enter the finale episode results before saving the finalists"},{status:409});const {error}=await db.from("episode_results").update({finale_winner:winner,finalists}).eq("episode_id",episodeId);if(error)return Response.json({error:"Finale results could not be saved"},{status:500});await publishDueResults();await refreshPublishedScores();return Response.json({ok:true,revealAt:episode.reveal_at,published:Date.now()>=new Date(episode.reveal_at).getTime()});
 }
 return Response.json({error:"Unknown action"},{status:400});
}
