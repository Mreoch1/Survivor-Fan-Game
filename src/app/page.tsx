import Link from "next/link";

export default function HomePage() {
  return (
    <div className="survivor-page survivor-page--home">
      <div className="survivor-auth__card" style={{ maxWidth: "32rem" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/image.png"
          alt="Survivor 50: In the Hands of the Fans"
          className="survivor-landing__logo"
        />
        <p className="survivor-auth__subtitle" style={{ marginBottom: "1.5rem", marginTop: "1rem" }}>
          Season 50: In the Hands of the Fans. Pick the winner, vote each week, choose your tribe. Outwit, outplay, outlast.
        </p>
        <div className="survivor-auth__form" style={{ gap: "0.75rem" }}>
          <Link href="/login" className="survivor-auth__submit" style={{ textAlign: "center", textDecoration: "none" }}>
            Sign in
          </Link>
          <Link href="/signup" className="survivor-btn survivor-btn--secondary" style={{ textAlign: "center", textDecoration: "none" }}>
            Create account
          </Link>
        </div>
        <p className="survivor-auth__subtitle" style={{ marginTop: "1rem", fontSize: "0.8125rem" }}>
          Invited? Use the link from your invite email to sign up.
        </p>
      </div>
    </div>
  );
}
