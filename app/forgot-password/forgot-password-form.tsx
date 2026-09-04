"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "../../lib/supabase/client";

export function ForgotPasswordForm({ expired }: { expired: boolean }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(expired ? "That reset link is invalid or has expired. Request a new one below." : "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const { error: resetError } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setBusy(false);
    if (resetError) {
      setError("We could not send a reset email right now. Wait a minute and try again.");
      return;
    }
    setMessage("If that email belongs to an account, a secure reset link is on its way. Check your inbox and spam folder.");
  }

  return <main className="auth-page"><form className="join-card auth-card" onSubmit={submit}><Link className="brand" href="/"><span className="brand-mark">51</span><span>OUTLAST<br/><small>FANTASY LEAGUE</small></span></Link><p className="eyebrow">Account recovery</p><h1>Relight your torch.</h1><p className="auth-intro">Enter the email used for your league account. We will send a secure link for choosing a new password.</p><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" required value={email} onChange={event=>setEmail(event.target.value)}/>{error&&<div className="notice" role="alert"><strong>{error}</strong></div>}{message&&<div className="notice" role="status"><strong>{message}</strong></div>}<div className="auth-actions"><button className="button button-primary" disabled={busy}>{busy?"Sending…":"Send reset link →"}</button><Link className="text-link" href="/login">Back to sign in</Link></div></form></main>;
}
