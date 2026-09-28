import { AppShell } from "./components/AppShell";
import { HomeView } from "./components/HomeView";
import { getChatGPTUser } from "./chatgpt-auth";
import { loadHomeSummary } from "../db/home";
import "./home.css";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  let data = null;
  try { data = await loadHomeSummary(user?.userId || null); }
  catch { console.error("Home dashboard unavailable"); }
  return <AppShell><HomeView data={data} signedIn={Boolean(user)} now={data?.loadedAt || 0}/></AppShell>;
}
