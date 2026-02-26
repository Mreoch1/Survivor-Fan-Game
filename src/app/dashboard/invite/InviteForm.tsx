"use client";

import { useState } from "react";

export function InviteForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  async function handleCreateInvite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setInviteLink(null);
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Failed to create invite" });
        return;
      }
      const link = `${window.location.origin}/signup?invite=${encodeURIComponent(data.token)}`;
      setInviteLink(link);
      setMessage({ type: "success", text: "Invite created. Copy the link below or send it to " + email });
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setMessage({ type: "success", text: "Link copied to clipboard." });
  }

  return (
    <div className="survivor-card">
      <form onSubmit={handleCreateInvite} style={{ marginBottom: "1rem" }}>
        <label className="survivor-auth__label" htmlFor="invite-email">
          Email (we&apos;ll generate a link to send them)
        </label>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="survivor-auth__input"
            placeholder="friend@example.com"
            style={{ flex: "1", minWidth: "200px" }}
          />
          <button type="submit" className="survivor-btn survivor-btn--primary" disabled={loading}>
            {loading ? "Creating…" : "Create invite link"}
          </button>
        </div>
      </form>
      {message && (
        <p
          className={
            message.type === "error"
              ? "survivor-auth__message survivor-auth__message--error"
              : "survivor-auth__message survivor-auth__message--success"
          }
          style={{ marginBottom: "1rem" }}
        >
          {message.text}
        </p>
      )}
      {inviteLink && (
        <div style={{ marginTop: "1rem" }}>
          <label className="survivor-auth__label">Invite link</label>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <input
              type="text"
              readOnly
              value={inviteLink}
              className="survivor-auth__input"
              style={{ flex: "1", minWidth: "0", fontSize: "0.875rem" }}
            />
            <button type="button" className="survivor-btn survivor-btn--secondary" onClick={copyLink}>
              Copy link
            </button>
          </div>
          <p style={{ fontSize: "0.8125rem", color: "var(--survivor-text-muted)", marginTop: "0.5rem" }}>
            Send this link to the person. They sign up or sign in with it to join the pool.
          </p>
        </div>
      )}
    </div>
  );
}
