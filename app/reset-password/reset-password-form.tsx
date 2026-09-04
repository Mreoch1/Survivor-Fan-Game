"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "../../lib/supabase/client";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setBusy(false);
      setError(updateError.message.includes("different") ? "Choose a password you have not used before." : "We could not update the password. Request a new reset link and try again.");
      return;
    }
    await supabase.auth.signOut({ scope: "local" });
    setBusy(false);
    setComplete(true);
  }

  if (complete) {
    return <main className="auth-page"><section className="join-card auth-card"><Link className="brand" href="/"><span className="brand-mark">51</span><span>OUTLAST<br/><small>FANTASY LEAGUE</small></span></Link><p className="eyebrow">Torch relit</p><h1>Password updated.</h1><p className="auth-intro auth-success">Your new password is ready. Sign in and return to the game.</p><div className="auth-actions"><Link className="button button-primary" href="/login">Sign in →</Link></div></section></main>;
  }

  return <main className="auth-page"><form className="join-card auth-card" onSubmit={submit}><Link className="brand" href="/"><span className="brand-mark">51</span><span>OUTLAST<br/><small>FANTASY LEAGUE</small></span></Link><p className="eyebrow">Account recovery</p><h1>Choose a new password.</h1><label htmlFor="password">New password</label><input id="password" type="password" minLength={8} autoComplete="new-password" required value={password} onChange={event=>setPassword(event.target.value)}/><small>Use at least 8 characters.</small><label htmlFor="confirmation">Confirm new password</label><input id="confirmation" type="password" minLength={8} autoComplete="new-password" required value={confirmation} onChange={event=>setConfirmation(event.target.value)}/>{error&&<div className="notice" role="alert"><strong>{error}</strong></div>}<div className="auth-actions"><button className="button button-primary" disabled={busy}>{busy?"Updating…":"Update password →"}</button></div></form></main>;
}
