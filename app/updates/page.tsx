import type { Metadata } from "next";
import { AppShell } from "../components/AppShell";
import { UpdateSections } from "../components/UpdateSections";
import { publishedUpdates } from "../../lib/league-updates";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "What's new" };

export default function UpdatesPage() {
  return <AppShell><main className="wrap interior-page help-page">
    <header className="page-hero"><p className="eyebrow">League updates</p><h1>What&apos;s new?</h1><p>Catch up on the important changes. These notes stay here whenever you need them.</p></header>
    <div className="updates-history">{publishedUpdates().slice().reverse().map(update => <UpdateSections key={update.id} update={update}/>)}</div>
    <div className="help-links"><a className="button button-primary" href="/play">Go to my picks</a><a href="/rules">Read the full rules</a><a href="/save">Save Outlast to my phone</a></div>
  </main></AppShell>;
}
