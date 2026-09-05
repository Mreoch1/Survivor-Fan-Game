import { getChatGPTUser, chatGPTSignInPath, chatGPTSignOutPath } from "../chatgpt-auth";
import { profileIcon } from "../profile-icons";
import { createAdminClient } from "../../lib/supabase/admin";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getChatGPTUser();
  let profile: { display_name: string; avatar_key: string } | null = null;
  let unreadMessages = 0;
  if (user) {
    const db = createAdminClient();
    const [profileResult, unreadResult] = await Promise.all([
      db.from("profiles").select("display_name,avatar_key").eq("id", user.userId).maybeSingle(),
      db.from("private_messages").select("id", { count: "exact", head: true }).eq("recipient_id", user.userId).is("read_at", null),
    ]);
    profile = profileResult.data;
    unreadMessages = unreadResult.count || 0;
  }
  const icon = profileIcon(profile?.avatar_key);
  return <>
    <header className="site-header">
      <div className="wrap nav-wrap">
        <a className="brand" href="/" aria-label="Outlast 51 home"><span className="brand-mark">51</span><span>OUTLAST<br/><small>FANTASY LEAGUE</small></span></a>
        <nav aria-label="Main navigation"><a href="/play">Play</a><a href="/season">My Season</a><a href="/cast">Cast</a><a href="/campfire">Campfire</a><a href="/messages">Messages{unreadMessages > 0 && <span className="nav-unread" aria-label={`${unreadMessages} unread private messages`}>{unreadMessages > 99 ? "99+" : unreadMessages}</span>}</a><a href="/rules">Rules</a></nav>
        {user ? <div className="account-actions"><a className="account-pill" href="/profile" title={profile?.display_name || user.displayName}><span aria-hidden="true">{icon.symbol}</span> Profile</a><a className="signout-link" href={chatGPTSignOutPath("/")}>Sign out</a></div> : <a className="account-pill" href={chatGPTSignInPath("/play")}>Sign in <span className="arrow">→</span></a>}
      </div>
    </header>
    {children}
    <footer><div className="wrap footer-inner"><div className="brand"><span className="brand-mark">51</span><span>OUTLAST<br/><small>FANTASY LEAGUE</small></span></div><p>Made for family, friends, and bragging rights.<br/>Unofficial fan league. Not affiliated with CBS or Paramount.</p><div><a href="/messages">Private Messages</a><a href="/rules">Rules</a><a href="/commissioner">Commissioner</a></div></div></footer>
  </>;
}
