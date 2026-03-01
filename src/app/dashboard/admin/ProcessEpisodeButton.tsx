"use client";

import { useState } from "react";

export function ProcessEpisodeButton({ episodeId }: { episodeId: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/process-episode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodeId }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("Scoring applied.");
      } else {
        setMessage(data.error ?? "Failed");
      }
    } catch {
      setMessage("Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span>
      <button
        type="button"
        className="survivor-btn survivor-btn--primary"
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? "Processing…" : "Process episode"}
      </button>
      {message && (
        <span className="survivor-dashboard__card-body" style={{ marginLeft: "0.5rem" }}>
          {message}
        </span>
      )}
    </span>
  );
}
