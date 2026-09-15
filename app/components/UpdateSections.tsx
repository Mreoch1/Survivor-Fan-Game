import type { LeagueUpdate } from "../../lib/league-updates";

export function UpdateSections({ update }: { update: LeagueUpdate }) {
  return <article className="update-article">
    <p className="eyebrow">{new Date(update.publishedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Detroit" })}</p>
    <h2>{update.title}</h2>
    {update.sections.map(section => <section className="update-section" key={section.title}>
      <h3>{section.title}</h3><p>{section.body}</p>
    </section>)}
  </article>;
}
