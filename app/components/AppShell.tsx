import { getChatGPTUser, chatGPTSignInPath, chatGPTSignOutPath } from "../chatgpt-auth";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getChatGPTUser();
  return <>
    <header className="site-header">
      <div className="wrap nav-wrap">
        <a className="brand" href="/" aria-label="Outlast 51 home"><span className="brand-mark">51</span><span>OUTLAST<br/><small>FANTASY LEAGUE</small></span></a>
        <nav aria-label="Main navigation"><a href="/play">Play</a><a href="/cast">Cast</a><a href="/campfire">Campfire</a><a href="/rules">Rules</a></nav>
        {user ? <a className="account-pill" href={chatGPTSignOutPath("/")}><span>{user.displayName.charAt(0).toUpperCase()}</span> Sign out</a> : <a className="account-pill" href={chatGPTSignInPath("/play")}>Sign in <span className="arrow">→</span></a>}
      </div>
    </header>
    {children}
    <footer><div className="wrap footer-inner"><div className="brand"><span className="brand-mark">51</span><span>OUTLAST<br/><small>FANTASY LEAGUE</small></span></div><p>Made for family, friends, and bragging rights.<br/>Unofficial fan league. Not affiliated with CBS or Paramount.</p><div><a href="/rules">Rules</a><a href="/commissioner">Commissioner</a></div></div></footer>
  </>;
}
