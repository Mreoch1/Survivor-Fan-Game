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
        <span className="survivor-header__user-email">{userEmail}</span>
      )}
      <form action={signOut}>
        <button
          type="submit"
          className="survivor-btn survivor-btn--secondary survivor-header__signout"
        >
          Sign out
        </button>
      </form>
    </nav>
  );
}
