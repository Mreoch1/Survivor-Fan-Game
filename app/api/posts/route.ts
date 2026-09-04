import { getChatGPTUser } from "../../chatgpt-auth";
import { createAdminClient } from "../../../lib/supabase/admin";
import { ensureDatabase,publishDueResults } from "../../../db/runtime";

async function spoilerWindow(){const db=createAdminClient(),now=new Date().toISOString();const {data}=await db.from("episodes").select("reveal_at").lte("air_at",now).gt("reveal_at",now).order("id",{ascending:false}).limit(1).maybeSingle();return data}
async function joinedUser(){const user=await getChatGPTUser();if(!user)return null;const {data}=await createAdminClient().from("profiles").select("league_joined_at").eq("id",user.userId).maybeSingle();return data?.league_joined_at?user:null}

export async function GET(){
 const user=await joinedUser();if(!user)return Response.json({error:"Join the league first"},{status:403});await ensureDatabase();await publishDueResults();const db=createAdminClient(),locked=await spoilerWindow();
 const {data:posts,error}=await db.from("posts").select("id,body,created_at,user_id").order("created_at",{ascending:false}).limit(50);if(error)return Response.json({error:"Campfire unavailable"},{status:500});
 const postIds=(posts||[]).map(post=>post.id),authorIds=[...new Set((posts||[]).map(post=>post.user_id))];
 const [{data:profiles},{data:votes}]=await Promise.all([authorIds.length?db.from("profiles").select("id,display_name,team_name,avatar_key").in("id",authorIds):Promise.resolve({data:[]}),postIds.length?db.from("post_votes").select("post_id,user_id,vote").in("post_id",postIds):Promise.resolve({data:[]})]);
 const names=new Map((profiles||[]).map(profile=>[profile.id,profile]));
 const enriched=(posts||[]).map(post=>{const postVotes=(votes||[]).filter(vote=>vote.post_id===post.id),upvotes=postVotes.filter(vote=>vote.vote===1).length,downvotes=postVotes.filter(vote=>vote.vote===-1).length;return{id:post.id,body:post.body,createdAt:post.created_at,name:names.get(post.user_id)?.display_name||"Player",teamName:names.get(post.user_id)?.team_name||"",avatarKey:names.get(post.user_id)?.avatar_key||"torch",upvotes,downvotes,score:upvotes-downvotes,myVote:postVotes.find(vote=>vote.user_id===user.userId)?.vote||0}}).sort((a,b)=>b.score-a.score||new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());
 return Response.json({posts:enriched,locked:!!locked,revealAt:locked?.reveal_at||null});
}

export async function POST(request:Request){
 const user=await joinedUser();if(!user)return Response.json({error:"Join the league first"},{status:403});await ensureDatabase();await publishDueResults();const locked=await spoilerWindow();if(locked)return Response.json({error:"Campfire posting reopens after the 9:00 AM spoiler reveal",revealAt:locked.reveal_at},{status:409});
 const body=await request.json() as {body?:string},text=body.body?.trim().slice(0,500);if(!text)return Response.json({error:"Bring an idea or message to the fire first"},{status:400});const {error}=await createAdminClient().from("posts").insert({user_id:user.userId,body:text,created_at:new Date().toISOString()});return error?Response.json({error:"That message could not be posted"},{status:500}):Response.json({ok:true});
}

export async function PUT(request:Request){
 const user=await joinedUser();if(!user)return Response.json({error:"Join the league first"},{status:403});await ensureDatabase();await publishDueResults();const locked=await spoilerWindow();if(locked)return Response.json({error:"Campfire voting reopens after the 9:00 AM spoiler reveal",revealAt:locked.reveal_at},{status:409});
 const body=await request.json() as {postId?:number;vote?:number},postId=Number(body.postId),vote=Number(body.vote);if(!Number.isInteger(postId)||![0,1,-1].includes(vote))return Response.json({error:"Choose an upvote or downvote"},{status:400});const db=createAdminClient(),{data:post}=await db.from("posts").select("id").eq("id",postId).maybeSingle();if(!post)return Response.json({error:"That Campfire post is no longer available"},{status:404});
 const now=new Date().toISOString();if(vote===0){const {error}=await db.from("post_votes").delete().eq("post_id",postId).eq("user_id",user.userId);return error?Response.json({error:"Your vote could not be removed"},{status:500}):Response.json({ok:true,vote:0,updatedAt:now})}
 const {error}=await db.from("post_votes").upsert({post_id:postId,user_id:user.userId,vote,updated_at:now},{onConflict:"post_id,user_id"});return error?Response.json({error:"Your vote could not be counted"},{status:500}):Response.json({ok:true,vote,updatedAt:now});
}
