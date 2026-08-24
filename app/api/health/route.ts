import { createAdminClient } from "../../../lib/supabase/admin";
export const dynamic="force-dynamic";
export async function GET(){try{const {error}=await createAdminClient().from("episodes").select("id").limit(1);if(error)throw error;return Response.json({status:"ok",database:"ok",version:process.env.VERCEL_GIT_COMMIT_SHA||"development"},{headers:{"cache-control":"no-store"}})}catch{return Response.json({status:"error",database:"unavailable",version:process.env.VERCEL_GIT_COMMIT_SHA||"development"},{status:503,headers:{"cache-control":"no-store"}})}}
