import { getChatGPTUser, chatGPTSignInPath, chatGPTSignOutPath } from "../chatgpt-auth";
import { profileIcon } from "../profile-icons";
import { createAdminClient } from "../../lib/supabase/admin";
import { CommunityNotifications } from "./CommunityNotifications";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getChatGPTUser();
  let profile: { display_name: string; avatar_key: string } | null = null;
  if (user) {
    const db = createAdminClient();
    const profileResult = await db.from("profiles").select("display_name,avatar_key").eq("id", user.userId).maybeSingle();
    profile = profileResult.data;
  }
  const icon = profileIcon(profile?.avatar_key);
  return <>
    <header className="site-header">
      <div className="wrap nav-wrap">
        <a className="brand" href="/" aria-label="Outlast 51 home"><span className="brand-mark">51</span><span>OUTLAST<br/><small>FANTASY LEAGUE</small></span></a>
        <nav aria-label="Main navigation"><a href="/play">Play</a><a href="/season">My Season</a><a href="/cast">Cast</a><CommunityNotifications signedIn={Boolean(user)}/><a href="/rules">Rules</a></nav>
        {user ? <div className="account-actions"><a className="account-pill" href="/profile" title={profile?.display_name || user.displayName}><span aria-hidden="true">{icon.symbol}</span> Profile</a><a className="signout-link" href={chatGPTSignOutPath("/")}>Sign out</a></div> : <a className="account-pill" href={chatGPTSignInPath("/play")}>Sign in <span className="arrow">→</span></a>}
      </div>
    </header>
    {children}
    <footer><div className="wrap footer-inner"><div className="brand"><span className="brand-mark">51</span><span>OUTLAST<br/><small>FANTASY LEAGUE</small></span></div><p>Made for family, friends, and bragging rights.<br/>Unofficial fan league. Not affiliated with CBS or Paramount.</p><div><a href="/messages">Private Messages</a><a href="/rules">Rules</a><a href="/commissioner">Commissioner</a></div></div></footer>
  </>;
}
