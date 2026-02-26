import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { InviteForm } from "./InviteForm";

export default async function InvitePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <>
      <h1 className="survivor-card__title" style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
        Invite family & friends
      </h1>
      <p style={{ color: "var(--survivor-text-muted)", marginBottom: "1.5rem" }}>
        Send an invite link by email or copy the link and share it. When they sign up or sign in with that link, they join the pool.
      </p>
      <InviteForm />
    </>
  );
}
