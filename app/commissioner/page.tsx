import type { Metadata } from "next";
import { requireChatGPTUser } from "../chatgpt-auth";
import { isCommissioner } from "../../db/runtime";
import { AppShell } from "../components/AppShell";
import { AdminClient } from "./admin-client";
export const dynamic="force-dynamic";export const metadata:Metadata={title:"Commissioner"};
export default async function Commissioner(){const user=await requireChatGPTUser("/commissioner");const allowed=isCommissioner(user.email),inviteCode=process.env.LEAGUE_INVITE_CODE||"";return <AppShell><main className="wrap interior-page"><header className="page-hero"><p className="eyebrow">Commissioner’s camp</p><h1>Run the league.</h1><p>Invite the family, review the weekly schedule, and use the backup controls when the AI commissioner needs a hand.</p></header>{allowed?<AdminClient inviteCode={inviteCode} inviteUrl={`${process.env.NEXT_PUBLIC_SITE_URL||"https://survivor-fan-game.vercel.app"}/signup`}/>:<div className="notice"><strong>Commissioner access is not enabled for {user.email}.</strong><span>Add this address to the site’s commissioner list.</span></div>}</main></AppShell>}
