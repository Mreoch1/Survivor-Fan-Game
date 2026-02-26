"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";

function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [gameCode, setGameCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const codeRes = await fetch("/api/validate-game-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: gameCode }),
    });
    const codeData = await codeRes.json();
    if (!codeRes.ok) {
      setLoading(false);
      setMessage({ type: "error", text: codeData.error ?? "Invalid game code" });
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: inviteToken
          ? `${window.location.origin}/auth/callback?invite=${encodeURIComponent(inviteToken)}`
          : `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }
    setMessage({
      type: "success",
      text: "Check your email for the confirmation link, then sign in.",
    });
  }

  return (
    <div className="survivor-page survivor-auth">
      <div className="survivor-auth__card">
        <h1 className="survivor-auth__title">Join the tribe</h1>
        <p className="survivor-auth__subtitle">Create your account</p>
        <form onSubmit={handleSubmit} className="survivor-auth__form">
          <label className="survivor-auth__label" htmlFor="displayName">
            Display name
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="survivor-auth__input"
            placeholder="How we&apos;ll see you on the leaderboard"
            autoComplete="name"
          />
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
          <label className="survivor-auth__label" htmlFor="gameCode">
            Game code
          </label>
          <input
            id="gameCode"
            type="text"
            value={gameCode}
            onChange={(e) => setGameCode(e.target.value)}
            className="survivor-auth__input"
            placeholder="Ask your host for the code"
            autoComplete="off"
          />
          <label className="survivor-auth__label" htmlFor="password">
            Password (min 6 characters)
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="survivor-auth__input"
            required
            minLength={6}
            autoComplete="new-password"
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
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>
        <div className="survivor-auth__links">
          <Link href={inviteToken ? `/login?invite=${inviteToken}` : "/login"} className="survivor-auth__link">
            Already have an account? Sign in
          </Link>
        </div>
        <Link href="/" className="survivor-auth__back">
          ← Back to camp
        </Link>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="survivor-page survivor-auth">
        <div className="survivor-auth__card">
          <p className="survivor-auth__subtitle">Loading…</p>
        </div>
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}
