import { publishDueResults } from "../../../../db/runtime";
export async function GET(request:Request){const supplied=request.headers.get("authorization"),expected=process.env.CRON_SECRET;if(!expected||supplied!==`Bearer ${expected}`)return Response.json({error:"Unauthorized"},{status:401});const published=await publishDueResults();return Response.json({ok:true,published})}
