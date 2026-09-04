import { getChatGPTUser } from "../../chatgpt-auth";
import { createAdminClient } from "../../../lib/supabase/admin";
import { ensureDatabase, isCastaway, publishDueResults } from "../../../db/runtime";

export async function PUT(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:"Sign in required"},{status:401});
 const body=await request.json() as {episodeId?:number;favoriteId?:string;immunityPick?:string;bootPick?:string;bonusPick?:string;shotInTheDark?:string;individualGamePick?:string};
 if(!body.episodeId||!body.favoriteId||!body.immunityPick)return Response.json({error:"Choose a weekly favorite and immunity winner"},{status:400});
 if(!isCastaway(body.favoriteId)||Boolean(body.bootPick&&!isCastaway(body.bootPick)))return Response.json({error:"One of those picks is not available"},{status:400});
 await ensureDatabase();await publishDueResults();const db=createAdminClient();
 const {data:pendingPrior}=await db.from("episodes").select("reveal_at").lt("id",body.episodeId).eq("results_posted",true).eq("results_published",false).order("id",{ascending:false}).limit(1).maybeSingle();if(pendingPrior)return Response.json({error:"Next-episode picks open after the 9:00 AM spoiler reveal"},{status:409});
 const {data:episode}=await db.from("episodes").select("lock_at,phase,bonus_options").eq("id",body.episodeId).eq("results_posted",false).maybeSingle();if(!episode||Date.now()>=new Date(episode.lock_at).getTime())return Response.json({error:"Picks are locked for this episode"},{status:409});
 const options=Array.isArray(episode.bonus_options)?episode.bonus_options.map(String):[],immunityValid=episode.phase==="individual"?isCastaway(body.immunityPick):["Savu","Toka"].includes(body.immunityPick),bonusValid=!body.bonusPick||options.includes(body.bonusPick);if(!immunityValid||!bonusValid)return Response.json({error:"One of those predictions is not available"},{status:400});
 const castawayPicks=[body.favoriteId,body.bootPick,episode.phase==="individual"?body.immunityPick:""] .filter(Boolean) as string[];if(castawayPicks.length){const {data:eliminated}=await db.from("cast_status").select("castaway_id").eq("status","eliminated").in("castaway_id",castawayPicks).limit(1);if(eliminated?.length)return Response.json({error:"That castaway has already left the game"},{status:400})}
 const {data:profile}=await db.from("profiles").select("individual_game_pick,league_joined_at").eq("id",user.userId).maybeSingle();if(!profile?.league_joined_at)return Response.json({error:"Join the league first"},{status:400});
 if(body.individualGamePick&&!isCastaway(body.individualGamePick))return Response.json({error:"Choose a valid opening Outlast Pick"},{status:400});
 if(body.episodeId===1&&!profile.individual_game_pick&&!body.individualGamePick)return Response.json({error:"Choose your opening Outlast Pick"},{status:400});
 if(body.individualGamePick!==undefined&&body.individualGamePick!==profile.individual_game_pick){const {data:first}=await db.from("episodes").select("lock_at").eq("id",1).maybeSingle();if(body.episodeId!==1||!first||Date.now()>=new Date(first.lock_at).getTime())return Response.json({error:"Your opening Outlast Pick is locked"},{status:409})}
 const shotInTheDark=["","immunity","boot","bonus"].includes(body.shotInTheDark||"")?body.shotInTheDark||"":"";
 if((shotInTheDark==="boot"&&!body.bootPick)||(shotInTheDark==="bonus"&&!body.bonusPick))return Response.json({error:"Choose that optional prediction before playing your Shot in the Dark"},{status:400});
 if(shotInTheDark){const {data:used}=await db.from("picks").select("id").eq("user_id",user.userId).neq("double_down","").neq("episode_id",body.episodeId).limit(1);if(used?.length)return Response.json({error:"Your Shot in the Dark has already been played"},{status:409})}
 const now=new Date().toISOString();const {error:pickError}=await db.from("picks").upsert({user_id:user.userId,episode_id:body.episodeId,favorite_id:body.favoriteId,immunity_pick:body.immunityPick,boot_pick:body.bootPick||"",bonus_pick:body.bonusPick||"",double_down:shotInTheDark,carried_from_episode_id:null,updated_at:now},{onConflict:"user_id,episode_id"});if(pickError)return Response.json({error:"Picks were not saved"},{status:500});
 if(body.individualGamePick){const {error}=await db.from("profiles").update({individual_game_pick:body.individualGamePick,updated_at:now}).eq("id",user.userId);if(error)return Response.json({error:"Your opening Outlast Pick was not saved"},{status:500})}
 return Response.json({ok:true,updatedAt:now});
}
