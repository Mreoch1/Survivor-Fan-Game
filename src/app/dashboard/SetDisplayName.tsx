"use client";

import { useState } from "react";

export function SetDisplayName() {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: name.trim() }),
      });
      if (res.ok) setDone(true);
    } finally {
      setSaving(false);
    }
  }

  if (done) return null;

  return (
    <div className="survivor-card" style={{ marginBottom: "1rem" }}>
      <p style={{ marginBottom: "0.75rem" }}>Add a display name for the leaderboard.</p>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="survivor-auth__input"
          placeholder="Display name"
          maxLength={100}
          style={{ maxWidth: "200px" }}
        />
        <button type="submit" className="survivor-btn survivor-btn--primary" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}
