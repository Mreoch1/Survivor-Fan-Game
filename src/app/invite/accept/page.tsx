"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

function InviteAcceptContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "accepted" | "invalid">("loading");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setStatus("invalid");
        return;
      }
      fetch("/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.ok) {
            setStatus("accepted");
            router.push("/dashboard");
            router.refresh();
          } else {
            setStatus("invalid");
          }
        })
        .catch(() => setStatus("invalid"));
    });
  }, [token, router]);

  if (status === "loading") {
    return (
      <div className="survivor-page">
        <div className="survivor-auth__card">
          <p className="survivor-auth__subtitle">Accepting invite…</p>
        </div>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="survivor-page">
        <div className="survivor-auth__card">
          <h1 className="survivor-auth__title">Invalid or expired invite</h1>
          <p className="survivor-auth__subtitle">Ask for a new invite link or sign in below.</p>
          <Link href="/login" className="survivor-auth__submit" style={{ display: "block", textAlign: "center", marginTop: "1rem", textDecoration: "none" }}>
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="survivor-page">
      <div className="survivor-auth__card">
        <p className="survivor-auth__subtitle">Redirecting to dashboard…</p>
      </div>
    </div>
  );
}

export default function InviteAcceptPage() {
  return (
    <Suspense fallback={
      <div className="survivor-page">
        <div className="survivor-auth__card">
          <p className="survivor-auth__subtitle">Loading…</p>
        </div>
      </div>
    }>
      <InviteAcceptContent />
    </Suspense>
  );
}
