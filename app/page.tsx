import { AppShell } from "./components/AppShell";
import { Countdown } from "./components/Countdown";
import Image from "next/image";

export default function Home() {
  return (
    <AppShell>
      <main>
        <section className="hero wrap island-hero">
          <div className="hero-copy">
            <p className="eyebrow">Season 51 · The Open Era</p>
            <h1>Outpick. Outlast.<br/><em>Outscore.</em></h1>
            <p className="lede">Back a castaway, call immunity and the vote-out, play your Double Down, and climb the family leaderboard every Wednesday night.</p>
            <div className="hero-actions">
              <a className="button button-primary" href="/play">Join the league <span>→</span></a>
              <a className="text-link" href="/rules">See how scoring works</a>
            </div>
          </div>
          <aside className="torch-card" aria-label="Next episode countdown">
            <div className="moon"><span>51</span></div>
            <div className="torch-content">
              <p className="card-label">Next challenge · Episode 1</p>
              <h2>Your picks lock in</h2>
              <Countdown target="2026-09-23T19:00:00-04:00" />
              <p className="time-note">Wed, Sep 23 · 7:00 PM ET<br/>One hour before the episode</p>
            </div>
          </aside>
        </section>

        <section className="open-era-feature wrap">
          <div className="open-era-photo"><Image src="/season-51-cast.jpg" alt="The 21 officially revealed Survivor Season 51 castaways" fill priority sizes="(max-width: 800px) 100vw, 58vw"/></div>
          <div className="open-era-copy"><p className="eyebrow">Official cast revealed</p><span className="whale-mark" aria-hidden="true">🐋</span><h2>Twenty-one players. No fixed playbook.</h2><p>Season 51 opens a new phase where any twist or advantage from the show’s history can surface without warning. Meet the confirmed cast before making your first picks.</p><a className="button button-primary" href="/cast">Meet the official cast →</a></div>
        </section>

        <section className="steps-section">
          <div className="wrap">
            <div className="section-heading split-heading">
              <div><p className="eyebrow">Your weekly ritual</p><h2>Make the read.</h2></div>
              <p>Make two simple core picks, then add optional bonus predictions if you want. Change anything before the deadline.</p>
            </div>
            <div className="steps-grid">
              <article className="step-card"><span className="step-number">01</span><div className="step-icon">♟</div><h3>Sign in and join</h3><p>Create your private league account, enter the invite code from Mike, and choose a team name.</p></article>
              <article className="step-card"><span className="step-number">02</span><div className="step-icon">◈</div><h3>Make two core picks</h3><p>Back a favorite and call immunity. Vote-out and wild-card picks are optional bonus chances.</p></article>
              <article className="step-card"><span className="step-number">03</span><div className="step-icon">↗</div><h3>Make your move</h3><p>Build streaks, find an underdog, or spend your one Double Down at the perfect moment.</p></article>
            </div>
          </div>
        </section>

        <section className="leader-preview wrap">
          <div>
            <p className="eyebrow">The fire is waiting</p>
            <h2>Everybody starts at zero.</h2>
            <p>Invite the family, make your opening picks, and see who reads the island best.</p>
          </div>
          <div className="scoreboard">
            {["You", "Camp Chaos", "Blindside Club"].map((name, i) => <div className="score-row" key={name}><span className="rank">0{i+1}</span><span className="avatar small">{name[0]}</span><strong>{name}</strong><span className="score">0 <small>PTS</small></span></div>)}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
