import type { Metadata } from "next";
import { requireChatGPTUser } from "../chatgpt-auth";
import { isCommissioner } from "../../db/runtime";
import { AppShell } from "../components/AppShell";
import { AdminClient } from "./admin-client";
export const dynamic="force-dynamic";export const metadata:Metadata={title:"Commissioner"};
export default async function Commissioner(){const user=await requireChatGPTUser("/commissioner");const allowed=isCommissioner(user.email);return <AppShell><main className="wrap interior-page"><header className="page-hero"><p className="eyebrow">Commissioner’s camp</p><h1>Run the league.</h1><p>Your AI commissioner verifies the weekly schedule, creates the bonus question, records episode results, and protects spoilers automatically. These controls remain available as a backup.</p></header>{allowed?<AdminClient/>:<div className="notice"><strong>Commissioner access is not enabled for {user.email}.</strong><span>Add this address to the site’s commissioner list.</span></div>}</main></AppShell>}
