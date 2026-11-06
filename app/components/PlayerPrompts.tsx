"use client";

import { useState, useSyncExternalStore } from "react";
import { LeagueUpdates } from "./LeagueUpdates";
import { PopupQuestions } from "./PopupQuestions";

function watchHash(notify: () => void) {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
}

export function PlayerPrompts({ showBonus = true }: { showBonus?: boolean }) {
  const [updatesReady, setUpdatesReady] = useState(false);
  // Keep the pick form available when a player follows the welcome's action.
  const choosingFinalTorch = useSyncExternalStore(watchHash,
    () => location.pathname === "/play" && location.hash === "#final-torch-pick", () => false);
  if (choosingFinalTorch) return null;
  return <>
    <LeagueUpdates onReadyChange={setUpdatesReady}/>
    {showBonus && <PopupQuestions enabled={updatesReady}/>}
  </>;
}
