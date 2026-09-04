import { getChatGPTUser } from "../../chatgpt-auth";
import { castaways } from "../../data";
import { createAdminClient } from "../../../lib/supabase/admin";
import { ensureDatabase, publishDueResults } from "../../../db/runtime";
import { carryForwardPicks } from "../../../db/pick-carryover";

type Standing={id:string;name:string;teamName:string;avatarKey:string;points:number;lastScore:number;immunityStreak:number;longestStreak:number;shotUsed:number};

export async function GET(){
 const user=await getChatGPTUser();
 if(!user)return Response.json({error:"Sign in required"},{status:401});
 await ensureDatabase();await publishDueResults();
 const db=createAdminClient();
 const {data:profile}=await db.from("profiles").select("id,display_name,team_name,avatar_key,individual_game_pick,endgame_pick,endgame_pick_switched,individual_game_points,endgame_points,endgame_pick_updated_at,immunity_streak,longest_streak,league_joined_at").eq("id",user.userId).maybeSingle();
 if(!profile?.league_joined_at)return Response.json({joined:false});

 let {data:episode}=await db.from("episodes").select("id,title,air_at,lock_at,reveal_at,phase,bonus_question,bonus_options").eq("results_posted",false).order("id").limit(1).maybeSingle();
 if(!episode){const latest=await db.from("episodes").select("id,title,air_at,lock_at,reveal_at,phase,bonus_question,bonus_options").order("id",{ascending:false}).limit(1).maybeSingle();episode=latest.data}
 if(!episode)return Response.json({error:"No scheduled episode"},{status:404});

 await carryForwardPicks(episode.id);
 const locked=Date.now()>=new Date(episode.lock_at).getTime();
 const {data:first}=await db.from("episodes").select("lock_at").eq("id",1).maybeSingle();
 const preseasonLocked=!!first&&Date.now()>=new Date(first.lock_at).getTime();
 const {data:pick}=await db.from("picks").select("favorite_id,immunity_pick,boot_pick,bonus_pick,double_down,carried_from_episode_id,updated_at").eq("user_id",user.userId).eq("episode_id",episode.id).maybeSingle();
 const [{data:statuses},{data:profiles},{data:allPicks},{data:publishedEpisodes},{data:pendingReveal},{data:individualEvent}]=await Promise.all([
  db.from("cast_status").select("castaway_id,status"),
  db.from("profiles").select("id,display_name,team_name,avatar_key,total_points,immunity_streak,longest_streak,created_at").not("league_joined_at","is",null).order("total_points",{ascending:false}).order("created_at"),
  db.from("picks").select("user_id,episode_id,favorite_id,immunity_pick,boot_pick,double_down,favorite_point,immunity_point,boot_point,bonus_point,underdog_point,streak_point,double_point"),
  db.from("episodes").select("id").eq("results_published",true).order("id",{ascending:false}).limit(1),
  db.from("episodes").select("id,title,reveal_at").eq("results_posted",true).eq("results_published",false).order("id",{ascending:false}).limit(1).maybeSingle(),
  db.from("episodes").select("id,reveal_at,results_published").eq("individual_game_started",true).limit(1).maybeSingle(),
 ]);

 const latestPublished=publishedEpisodes?.[0]?.id;
 const standings:Standing[]=(profiles||[]).map(p=>{const userPicks=(allPicks||[]).filter(k=>k.user_id===p.id),latest=userPicks.find(k=>k.episode_id===latestPublished),lastScore=latest?latest.favorite_point+latest.immunity_point+latest.boot_point+latest.bonus_point+latest.underdog_point+latest.streak_point+latest.double_point:0;return{id:p.id,name:p.display_name,teamName:p.team_name,avatarKey:p.avatar_key,points:Number(p.total_points),lastScore,immunityStreak:p.immunity_streak,longestStreak:p.longest_streak,shotUsed:userPicks.filter(k=>k.double_down).length}});
 let rank=0,last:number|null=null;
 const leaderboard=standings.map((row,index)=>{if(last!==row.points)rank=index+1;last=row.points;const badges=[];if(rank===1&&row.points>0)badges.push("Torch Leader");if(row.longestStreak>=3)badges.push("Challenge Reader");if(row.points>=20)badges.push("Strategist");return{...row,rank,badges}});
 let pickPercentages:null|Record<string,{value:string;count:number;percent:number}[]>=null;
 if(locked){pickPercentages={};for(const field of ["favorite_id","immunity_pick","boot_pick"] as const){const counts=new Map<string,number>();for(const row of (allPicks||[]).filter(k=>k.episode_id===episode.id)){const value=row[field];if(value)counts.set(value,(counts.get(value)||0)+1)}const total=[...counts.values()].reduce((a,b)=>a+b,0);pickPercentages[field]=[...counts].map(([value,count])=>({value,count,percent:total?Math.round(count*100/total):0}))}}

 const matchups=[];for(let index=0;index<leaderboard.length;index+=2){const a=leaderboard[index],b=leaderboard[index+1];if(a)matchups.push({a:{name:a.teamName||a.name,points:a.lastScore},b:b?{name:b.teamName||b.name,points:b.lastScore}:null})}
 const statusMap=new Map((statuses||[]).map(status=>[status.castaway_id,status.status]));
 const activeCastaways=castaways.filter(c=>(statusMap.get(c.id)||"active")==="active");
 const currentStanding=standings.find(standing=>standing.id===profile.id);
 const {data:nextAfterIndividual}=individualEvent?await db.from("episodes").select("id,lock_at").gt("id",individualEvent.id).order("id").limit(1).maybeSingle():{data:null};
 const repickClosesAt=nextAfterIndividual?.lock_at||null;
 const repickOpen=Boolean(individualEvent?.results_published&&(!repickClosesAt||Date.now()<new Date(repickClosesAt).getTime()));
 const seasonPickStage=!preseasonLocked?"opening":!individualEvent?.results_published?"waiting":repickOpen?"repick":"locked";
 const castawayName=(id:string|null)=>castaways.find(c=>c.id===id)?.name||null;

 return Response.json({
  joined:true,
  profile:{displayName:profile.display_name,teamName:profile.team_name,immunityStreak:profile.immunity_streak},
  episode:{id:episode.id,title:episode.title,airAt:episode.air_at,lockAt:episode.lock_at,revealAt:episode.reveal_at,phase:episode.phase,bonusQuestion:episode.bonus_question,bonusOptions:episode.bonus_options},
  castaways:activeCastaways.map(c=>({...c,status:"active"})),
  pick:pick?{favoriteId:pick.favorite_id,immunityPick:pick.immunity_pick,bootPick:pick.boot_pick,bonusPick:pick.bonus_pick,shotInTheDark:pick.double_down,carriedFromEpisodeId:pick.carried_from_episode_id,updatedAt:pick.updated_at}:null,
  seasonPick:{stage:seasonPickStage,originalId:profile.individual_game_pick||"",originalName:castawayName(profile.individual_game_pick),endgameId:profile.endgame_pick||"",endgameName:castawayName(profile.endgame_pick),switched:Boolean(profile.endgame_pick_switched),individualGamePoints:Number(profile.individual_game_points||0),endgamePoints:Number(profile.endgame_points||0),repickClosesAt,updatedAt:profile.endgame_pick_updated_at},
  leaderboard,locked,preseasonLocked,pickPercentages,matchups,
  pendingReveal:pendingReveal?{id:pendingReveal.id,title:pendingReveal.title,revealAt:pendingReveal.reveal_at}:null,
  shotInTheDarkAvailable:profile?!currentStanding?.shotUsed:false,
 });
}

export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:"Sign in required"},{status:401});
 const body=await request.json() as {displayName?:string;teamName?:string;inviteCode?:string};const displayName=body.displayName?.trim().slice(0,40),teamName=body.teamName?.trim().slice(0,50)||"";if(!displayName)return Response.json({error:"Name is required"},{status:400});
 await ensureDatabase();const db=createAdminClient(),{data:existing}=await db.from("profiles").select("league_joined_at").eq("id",user.userId).maybeSingle();const expected=String(process.env.LEAGUE_INVITE_CODE||"").trim().toUpperCase(),supplied=String(body.inviteCode||"").trim().toUpperCase();if(!existing?.league_joined_at&&expected&&supplied!==expected)return Response.json({error:"That league invite code is not valid"},{status:403});const {error}=await db.from("profiles").update({display_name:displayName,team_name:teamName,league_joined_at:existing?.league_joined_at||new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",user.userId);if(error)return Response.json({error:"The league could not be joined"},{status:500});return Response.json({ok:true});
}
