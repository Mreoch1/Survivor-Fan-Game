"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin page error:", error);
  }, [error]);

  return (
    <div className="survivor-card" style={{ maxWidth: "32rem", margin: "2rem auto", padding: "1.5rem" }}>
      <h2 className="survivor-card__title" style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>
        Something went wrong
      </h2>
      <p style={{ color: "var(--survivor-text-muted)", marginBottom: "1rem" }}>
        The admin page could not load. This can happen if the database schema is out of date or data is in an
        unexpected format. Try again or check server logs for details.
      </p>
      <div className="survivor-admin-inline" style={{ gap: "0.75rem" }}>
        <button type="button" onClick={reset} className="survivor-btn survivor-btn--primary">
          Try again
        </button>
        <Link href="/dashboard" className="survivor-btn survivor-btn--secondary">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
