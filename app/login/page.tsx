"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    const { error: authError } = await createClient().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (authError) return setError("That email or password did not work.");
    const next = new URLSearchParams(window.location.search).get("returnTo");
    router.push(next?.startsWith("/") && !next.startsWith("//") ? next : "/play");
    router.refresh();
  }
  return <main className="auth-page"><form className="join-card auth-card" onSubmit={submit}><Link className="brand" href="/"><span className="brand-mark">51</span><span>OUTLAST<br/><small>FANTASY LEAGUE</small></span></Link><p className="eyebrow">Welcome back</p><h1>Sign in to camp.</h1><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/><label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/>{error&&<div className="notice">{error}</div>}<button className="button button-primary" disabled={busy}>{busy?"Signing in…":"Sign in →"}</button><p>New player? <Link href="/signup">Create an account</Link></p></form></main>;
}
