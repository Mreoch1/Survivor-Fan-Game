import Link from "next/link";
import { signOut } from "./actions";

interface DashboardNavProps {
  userEmail?: string | null;
}

export function DashboardNav({ userEmail }: DashboardNavProps) {
  return (
    <nav className="survivor-header__nav">
      <Link href="/dashboard" className="survivor-header__link">
        Home
      </Link>
      <Link href="/dashboard/players" className="survivor-header__link">
        Cast
      </Link>
      <Link href="/dashboard/picks" className="survivor-header__link">
        My picks
      </Link>
      <Link href="/dashboard/leaderboard" className="survivor-header__link">
        Leaderboard
      </Link>
      <Link href="/dashboard/results" className="survivor-header__link">
        Results
      </Link>
      <Link href="/dashboard/invite" className="survivor-header__link">
        Invite
      </Link>
      {userEmail && (
        <span className="survivor-header__link" style={{ fontSize: "0.875rem", color: "var(--survivor-text-muted)" }}>
          {userEmail}
        </span>
      )}
      <form action={signOut}>
        <button type="submit" className="survivor-btn survivor-btn--secondary" style={{ padding: "0.375rem 0.75rem", fontSize: "0.875rem" }}>
          Sign out
        </button>
      </form>
    </nav>
  );
}
