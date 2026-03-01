import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { DashboardNav } from "@/components/DashboardNav";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("profiles")
    .update({ email: user.email ?? null, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  return (
    <div className="survivor-app">
      <header className="survivor-header">
        <Link href="/dashboard" className="survivor-header__logo" aria-label="Survivor Fan Game home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/image.png" alt="Survivor 50: In the Hands of the Fans" className="survivor-header__logo-img" />
        </Link>
        <DashboardNav userEmail={user.email} isAdmin={profile?.is_admin ?? false} />
      </header>
      <main className="survivor-main">{children}</main>
    </div>
  );
}
