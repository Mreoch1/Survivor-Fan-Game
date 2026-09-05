"use client";

export default function SeasonError({ reset }: { reset: () => void }) {
  return <main className="wrap interior-page"><div className="notice"><strong>Your scorecard could not load.</strong><span>Your saved picks are safe. Try again in a moment.</span></div><button className="button button-primary" onClick={reset}>Try again</button> <a className="text-link" href="/play">Back to my picks</a></main>;
}
