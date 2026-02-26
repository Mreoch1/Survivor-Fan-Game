"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }
    const next = inviteToken ? `/invite/accept?token=${encodeURIComponent(inviteToken)}` : "/dashboard";
    router.push(next);
    router.refresh();
  }

  return (
    <div className="survivor-page survivor-auth">
      <div className="survivor-auth__card">
        <h1 className="survivor-auth__title">Outwit. Outplay. Outlast.</h1>
        <p className="survivor-auth__subtitle">Sign in to your camp</p>
        <form onSubmit={handleSubmit} className="survivor-auth__form">
          <label className="survivor-auth__label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="survivor-auth__input"
            required
            autoComplete="email"
          />
          <label className="survivor-auth__label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="survivor-auth__input"
            required
            autoComplete="current-password"
          />
          {message && (
            <p
              className={
                message.type === "error"
                  ? "survivor-auth__message survivor-auth__message--error"
                  : "survivor-auth__message survivor-auth__message--success"
              }
            >
              {message.text}
            </p>
          )}
          <button type="submit" className="survivor-auth__submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <div className="survivor-auth__links">
          <Link href="/forgot-password" className="survivor-auth__link">
            Forgot password?
          </Link>
          <Link
            href={inviteToken ? `/signup?invite=${inviteToken}` : "/signup"}
            className="survivor-auth__link"
          >
            Create an account
          </Link>
        </div>
        <Link href="/" className="survivor-auth__back">
          ← Back to camp
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="survivor-page survivor-auth">
        <div className="survivor-auth__card">
          <p className="survivor-auth__subtitle">Loading…</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
