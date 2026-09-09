import { createAdminClient } from "../lib/supabase/admin";
import { isCastaway } from "./runtime";

// Play Your Advantage risks a point, so it requires a fresh choice each episode.
export async function carryForwardPicks(episodeId:number){
 const db=createAdminClient();const {data:target}=await db.from("episodes").select("id,phase").eq("id",episodeId).eq("results_posted",false).maybeSingle();if(!target)return 0;
 const {data:pending}=await db.from("episodes").select("id").lt("id",episodeId).eq("results_posted",true).eq("results_published",false).limit(1).maybeSingle();if(pending)return 0;
 const [{data:statuses},{data:players},{data:existing}]=await Promise.all([db.from("cast_status").select("castaway_id,status"),db.from("profiles").select("id").not("league_joined_at","is",null),db.from("picks").select("user_id").eq("episode_id",episodeId)]);
 const eliminated=new Set((statuses||[]).filter(s=>s.status==="eliminated").map(s=>s.castaway_id)),active=(id:string)=>Boolean(id&&isCastaway(id)&&!eliminated.has(id)),has=new Set((existing||[]).map(p=>p.user_id));let carried=0;
 for(const player of players||[]){if(has.has(player.id))continue;const {data:prior}=await db.from("picks").select("episode_id,favorite_id,immunity_pick,boot_pick").eq("user_id",player.id).lt("episode_id",episodeId).order("episode_id",{ascending:false}).limit(1).maybeSingle();if(!prior)continue;const favorite=active(prior.favorite_id)?prior.favorite_id:"",immunity=target.phase==="tribe"?(["Savu","Toka"].includes(prior.immunity_pick)?prior.immunity_pick:""):(active(prior.immunity_pick)?prior.immunity_pick:""),boot=active(prior.boot_pick)?prior.boot_pick:"";if(!favorite&&!immunity&&!boot)continue;const {error}=await db.from("picks").insert({user_id:player.id,episode_id:episodeId,favorite_id:favorite,immunity_pick:immunity,boot_pick:boot,bonus_pick:"",double_down:"",carried_from_episode_id:prior.episode_id,updated_at:new Date().toISOString()});if(error)throw error;carried++}
 return carried;
}
