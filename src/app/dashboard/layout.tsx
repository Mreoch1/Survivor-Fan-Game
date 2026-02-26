import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { DashboardNav } from "@/components/DashboardNav";

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

  return (
    <div className="survivor-app">
      <header className="survivor-header">
        <Link href="/dashboard" className="survivor-header__logo">
          Survivor Fan Game
        </Link>
        <DashboardNav userEmail={user.email} />
      </header>
      <main className="survivor-main">{children}</main>
    </div>
  );
}
