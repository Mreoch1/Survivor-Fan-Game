"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);
    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }
    setMessage({
      type: "success",
      text: "Check your email for the password reset link.",
    });
  }

  return (
    <div className="survivor-page survivor-auth">
      <div className="survivor-auth__card">
        <h1 className="survivor-auth__title">Lost your torch?</h1>
        <p className="survivor-auth__subtitle">We&apos;ll send a reset link to your email</p>
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
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
        <Link href="/login" className="survivor-auth__back">
          ← Back to sign in
        </Link>
      </div>
    </div>
  );
}
