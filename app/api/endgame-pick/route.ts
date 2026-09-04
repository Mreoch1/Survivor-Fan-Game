import { getChatGPTUser } from "../../chatgpt-auth";
import { createAdminClient } from "../../../lib/supabase/admin";
import { ensureDatabase, isCastaway, publishDueResults, refreshPublishedScores } from "../../../db/runtime";

export async function PUT(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:"Sign in required"},{status:401});
 const body=await request.json() as {castawayId?:string};const castawayId=String(body.castawayId||"");if(!isCastaway(castawayId))return Response.json({error:"Choose a remaining castaway"},{status:400});
 await ensureDatabase();await publishDueResults();const db=createAdminClient();
 const {data:individualEvent}=await db.from("episodes").select("id,results_published").eq("individual_game_started",true).limit(1).maybeSingle();if(!individualEvent?.results_published)return Response.json({error:"The Final Torch decision is not open yet"},{status:409});
 const {data:nextEpisode}=await db.from("episodes").select("lock_at").gt("id",individualEvent.id).order("id").limit(1).maybeSingle();if(nextEpisode&&Date.now()>=new Date(nextEpisode.lock_at).getTime())return Response.json({error:"The Final Torch decision is locked"},{status:409});
 const [{data:profile},{data:status}]=await Promise.all([db.from("profiles").select("individual_game_pick,league_joined_at").eq("id",user.userId).maybeSingle(),db.from("cast_status").select("status").eq("castaway_id",castawayId).maybeSingle()]);
 if(!profile?.league_joined_at)return Response.json({error:"Join the league first"},{status:403});if(status?.status==="eliminated")return Response.json({error:"Choose a castaway still in the game"},{status:400});
 const now=new Date().toISOString(),switched=castawayId!==profile.individual_game_pick;const {error}=await db.from("profiles").update({endgame_pick:castawayId,endgame_pick_switched:switched,endgame_pick_updated_at:now,updated_at:now}).eq("id",user.userId);if(error)return Response.json({error:"Your Final Torch pick was not saved"},{status:500});await refreshPublishedScores();return Response.json({ok:true,castawayId,switched,updatedAt:now});
}
