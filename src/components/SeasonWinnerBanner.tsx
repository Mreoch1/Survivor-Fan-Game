import {
  getSeason50WinnerDisplay,
  type SeasonWinnerDisplay,
} from "@/lib/season-50-winner-display";

type Props = {
  display?: SeasonWinnerDisplay | null;
};

export async function SeasonWinnerBanner({ display: displayProp }: Props = {}) {
  const display = displayProp ?? (await getSeason50WinnerDisplay());
  if (!display) return null;

  const { podium, fanStandings } = display;
  const first = podium.find((p) => p.place === 1);
  const second = podium.find((p) => p.place === 2);
  const third = podium.find((p) => p.place === 3);

  return (
    <section
      className="survivor-winner-banner"
      aria-labelledby="survivor-winner-banner-title"
    >
      <div className="survivor-winner-banner__glow" aria-hidden />
      <div className="survivor-winner-banner__inner">
        <p className="survivor-winner-banner__eyebrow">Season 50: In the Hands of the Fans</p>
        <h2 id="survivor-winner-banner-title" className="survivor-winner-banner__title">
          The tribe has spoken
        </h2>

        <div className="survivor-winner-banner__podium" role="list" aria-label="Finale podium">
          {second ? (
            <article className="survivor-winner-banner__podium-slot survivor-winner-banner__podium-slot--second" role="listitem">
              <p className="survivor-winner-banner__place">2nd</p>
              {second.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={second.imageUrl}
                  alt=""
                  width={72}
                  height={72}
                  className="survivor-winner-banner__photo"
                />
              ) : (
                <div className="survivor-winner-banner__photo survivor-winner-banner__photo--placeholder" aria-hidden />
              )}
              <p className="survivor-winner-banner__name">{second.name}</p>
            </article>
          ) : null}

          {first ? (
            <article
              className="survivor-winner-banner__podium-slot survivor-winner-banner__podium-slot--first"
              role="listitem"
            >
              <p className="survivor-winner-banner__place survivor-winner-banner__place--winner">Sole Survivor</p>
              {first.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={first.imageUrl}
                  alt=""
                  width={96}
                  height={96}
                  className="survivor-winner-banner__photo survivor-winner-banner__photo--winner"
                />
              ) : (
                <div
                  className="survivor-winner-banner__photo survivor-winner-banner__photo--winner survivor-winner-banner__photo--placeholder"
                  aria-hidden
                />
              )}
              <p className="survivor-winner-banner__name survivor-winner-banner__name--winner">{first.name}</p>
            </article>
          ) : null}

          {third ? (
            <article className="survivor-winner-banner__podium-slot survivor-winner-banner__podium-slot--third" role="listitem">
              <p className="survivor-winner-banner__place">3rd</p>
              {third.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={third.imageUrl}
                  alt=""
                  width={72}
                  height={72}
                  className="survivor-winner-banner__photo"
                />
              ) : (
                <div className="survivor-winner-banner__photo survivor-winner-banner__photo--placeholder" aria-hidden />
              )}
              <p className="survivor-winner-banner__name">{third.name}</p>
            </article>
          ) : null}
        </div>

        {fanStandings.length > 0 ? (
          <div className="survivor-winner-banner__fan-scores">
            <h3 className="survivor-winner-banner__fan-title">Fan game final scores</h3>
            <ol className="survivor-winner-banner__fan-list">
              {fanStandings.map((row) => (
                <li key={row.rank} className="survivor-winner-banner__fan-row">
                  <span className="survivor-winner-banner__fan-rank">{row.rank}</span>
                  <span className="survivor-winner-banner__fan-name">{row.name}</span>
                  <span className="survivor-winner-banner__fan-points">{row.points} pts</span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </section>
  );
}
