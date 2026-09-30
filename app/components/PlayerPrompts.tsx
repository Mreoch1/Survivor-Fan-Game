"use client";

import { useState } from "react";
import { LeagueUpdates } from "./LeagueUpdates";
import { PopupQuestions } from "./PopupQuestions";

export function PlayerPrompts({ showBonus = true }: { showBonus?: boolean }) {
  const [updatesReady, setUpdatesReady] = useState(false);
  return <>
    <LeagueUpdates onReadyChange={setUpdatesReady}/>
    {showBonus && <PopupQuestions enabled={updatesReady}/>}
  </>;
}
