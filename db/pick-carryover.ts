import { createAdminClient } from "../lib/supabase/admin";
import { isCastaway } from "./runtime";
import { carryWildCardAnswer } from "../lib/wild-card-carryover";

export async function carryForwardPicks(episodeId:number){
 const db=createAdminClient();const {data:target}=await db.from("episodes").select("id,phase,bonus_question,bonus_options").eq("id",episodeId).eq("results_posted",false).maybeSingle();if(!target)return 0;
 const {data:questionRows,error:questionError}=await db.from("episodes").select("id,bonus_question").lt("id",episodeId);if(questionError)throw questionError;const questions=new Map((questionRows||[]).map(row=>[row.id,row.bonus_question]));
 const {data:pending}=await db.from("episodes").select("id").lt("id",episodeId).eq("results_posted",true).eq("results_published",false).limit(1).maybeSingle();if(pending)return 0;
 const [{data:statuses},{data:players},{data:existing}]=await Promise.all([db.from("cast_status").select("castaway_id,status"),db.from("profiles").select("id").not("league_joined_at","is",null),db.from("picks").select("user_id").eq("episode_id",episodeId)]);
 const eliminated=new Set((statuses||[]).filter(s=>s.status==="eliminated").map(s=>s.castaway_id)),active=(id:string)=>Boolean(id&&isCastaway(id)&&!eliminated.has(id)),has=new Set((existing||[]).map(p=>p.user_id)),options=new Set((Array.isArray(target.bonus_options)?target.bonus_options:[]).map(String));let carried=0;
 for(const player of players||[]){if(has.has(player.id))continue;const {data:prior}=await db.from("picks").select("episode_id,favorite_id,immunity_pick,boot_pick,bonus_pick").eq("user_id",player.id).lt("episode_id",episodeId).order("episode_id",{ascending:false}).limit(1).maybeSingle();if(!prior)continue;const favorite=active(prior.favorite_id)?prior.favorite_id:"",immunity=target.phase==="tribe"?(["Savu","Toka"].includes(prior.immunity_pick)?prior.immunity_pick:""):(active(prior.immunity_pick)?prior.immunity_pick:""),boot=active(prior.boot_pick)?prior.boot_pick:"",bonus=carryWildCardAnswer({answer:prior.bonus_pick,previousQuestion:questions.get(prior.episode_id)||"",nextQuestion:target.bonus_question,nextOptions:[...options]});if(!favorite&&!immunity&&!boot&&!bonus)continue;const {error}=await db.from("picks").insert({user_id:player.id,episode_id:episodeId,favorite_id:favorite,immunity_pick:immunity,boot_pick:boot,bonus_pick:bonus,double_down:"",carried_from_episode_id:prior.episode_id,updated_at:new Date().toISOString()});if(error)throw error;carried++}
 return carried;
}
