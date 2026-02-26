"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }
    setMessage({ type: "success", text: "Password updated. Redirecting…" });
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="survivor-page survivor-auth">
      <div className="survivor-auth__card">
        <h1 className="survivor-auth__title">Set new password</h1>
        <p className="survivor-auth__subtitle">Choose a new password (min 6 characters)</p>
        <form onSubmit={handleSubmit} className="survivor-auth__form">
          <label className="survivor-auth__label" htmlFor="password">
            New password
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
            {loading ? "Updating…" : "Update password"}
          </button>
        </form>
        <Link href="/dashboard" className="survivor-auth__back">
          ← Back to dashboard
        </Link>
      </div>
    </div>
  );
}
