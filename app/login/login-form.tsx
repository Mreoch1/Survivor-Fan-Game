"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient, rememberSignIn } from "../../lib/supabase/client";
import { safeAuthReturnPath } from "../../lib/auth-return-path";

export default function LoginForm({ defaultRemembered }: { defaultRemembered: boolean }) {
  const [remembered, setRemembered] = useState(defaultRemembered);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      rememberSignIn(remembered);
      const { error: authError } = await createClient().auth.signInWithPassword({ email, password });
      if (authError) return setError("That email or password did not work.");
      const next = new URLSearchParams(window.location.search).get("returnTo");
      window.location.assign(safeAuthReturnPath(next));
    } catch {
      setError("Sign-in could not connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return <main className="auth-page"><form className="join-card auth-card" onSubmit={submit}><Link className="brand" href="/"><span className="brand-mark">51</span><span>OUTLAST<br/><small>FANTASY LEAGUE</small></span></Link><p className="eyebrow">Welcome back</p><h1>Sign in to camp.</h1><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/><div className="auth-label-row"><label htmlFor="password">Password</label><Link href="/forgot-password">Forgot password?</Link></div><input id="password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/><label className="remember-signin" htmlFor="remember-signin"><input id="remember-signin" type="checkbox" checked={remembered} onChange={event => setRemembered(event.target.checked)} aria-describedby="remember-help"/><span>Keep me signed in</span></label><small id="remember-help" className="remember-help">Stay signed in for 90 days on this device. Uncheck on a shared device.</small>{error&&<div className="notice" role="alert">{error}</div>}<button className="button button-primary" disabled={busy}>{busy?"Signing in…":"Sign in →"}</button><p>New player? <Link href="/signup">Create an account</Link></p></form></main>;
}
