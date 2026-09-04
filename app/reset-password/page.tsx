import type { Metadata } from "next";
import Link from "next/link";
import { createAuthClient } from "../../lib/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Choose a New Password" };

export default async function ResetPasswordPage() {
  const { data, error } = await (await createAuthClient()).auth.getClaims();
  if (error || !data?.claims?.sub) {
    return <main className="auth-page"><section className="join-card auth-card"><Link className="brand" href="/"><span className="brand-mark">51</span><span>OUTLAST<br/><small>FANTASY LEAGUE</small></span></Link><p className="eyebrow">Reset link needed</p><h1>This link has expired.</h1><p className="auth-intro">Password reset links are temporary and can only be used once. Request a new link to continue.</p><div className="auth-actions"><Link className="button button-primary" href="/forgot-password">Request a new link →</Link><Link className="text-link" href="/login">Back to sign in</Link></div></section></main>;
  }
  return <ResetPasswordForm />;
}
