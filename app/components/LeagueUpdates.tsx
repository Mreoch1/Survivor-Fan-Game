"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LeagueUpdate } from "../../lib/league-updates";
import { MERGE_WELCOME_ID, type MergeWelcomeData } from "../../lib/merge-welcome";
import { MergeWelcome } from "./MergeWelcome";
import { UpdateSections } from "./UpdateSections";

export function LeagueUpdates({ onReadyChange }: { onReadyChange?: (ready: boolean) => void }) {
  const router = useRouter();
  const [updates, setUpdates] = useState<LeagueUpdate[]>([]);
  const [mergeWelcome, setMergeWelcome] = useState<MergeWelcomeData | null>(null);
  const [goingToPick, setGoingToPick] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const requestNumber = useRef({ value: 0 });
  const savingRef = useRef(false);

  const load = useCallback(async () => {
    if (savingRef.current || document.visibilityState !== "visible") return;
    const request = ++requestNumber.current.value;
    try {
      const response = await fetch("/api/updates", { cache: "no-store" });
      if (request !== requestNumber.current.value) return;
      if (response.status === 401) { setUpdates([]); setMergeWelcome(null); setError(""); onReadyChange?.(false); return; }
      if (!response.ok) throw new Error("Updates could not load");
      const data = await response.json();
      if (request !== requestNumber.current.value) return;
      setUpdates(data.updates);
      setMergeWelcome(data.mergeWelcome ?? null);
      onReadyChange?.(!data.mergeWelcome && data.updates.length === 0);
      setError("");
    } catch {
      if (request === requestNumber.current.value) {
        setError("We couldn't load the latest updates. Please try again.");
        onReadyChange?.(false);
      }
    }
  }, [onReadyChange]);

  useEffect(() => {
    const requests = requestNumber.current;
    // This synchronizes with the server; every state update follows an awaited fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", load);
    return () => {
      requests.value++;
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", load);
    };
  }, [load]);

  const closesAt = mergeWelcome?.repickClosesAt;
  useEffect(() => {
    if (!closesAt) return;
    const timer = window.setTimeout(() => void load(), Math.max(0, Date.parse(closesAt) - Date.now()) + 100);
    return () => window.clearTimeout(timer);
  }, [closesAt, load]);

  const showStandardUpdates = updates.length > 0 && !mergeWelcome && !goingToPick;
  useEffect(() => {
    const element = dialog.current;
    if (!element || !showStandardUpdates) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Native cancel does not bubble reliably through React's delegated events.
    const keepOpen = (event: Event) => event.preventDefault();
    element.addEventListener("cancel", keepOpen);
    if (!element.open) element.showModal();
    return () => {
      element.removeEventListener("cancel", keepOpen);
      element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [showStandardUpdates]);

  async function acknowledge(goToPicks = false) {
    if (savingRef.current) return;
    savingRef.current = true;
    requestNumber.current.value++; // An older read must not reopen a confirmed notice.
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/updates", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ updateIds: mergeWelcome ? [MERGE_WELCOME_ID] : updates.map(update => update.id) }),
      });
      if (mergeWelcome && response.status === 409) {
        setMergeWelcome(null);
        onReadyChange?.(updates.length === 0);
        return;
      }
      if (!response.ok) throw new Error("Confirmation was not saved");
      if (mergeWelcome) {
        setMergeWelcome(null);
        onReadyChange?.(!goToPicks && updates.length === 0);
        if (goToPicks) {
          setGoingToPick(true);
          if (window.location.pathname === "/play") window.location.hash = "final-torch-pick";
          else router.push("/play#final-torch-pick");
        }
      } else {
        setUpdates([]);
        onReadyChange?.(true);
      }
    } catch {
      if (mergeWelcome) throw new Error("Your confirmation wasn't saved. Please try again.");
      setError("Your confirmation wasn't saved. Please tap the button to try again.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (goingToPick) return null;
  if (mergeWelcome) return <MergeWelcome welcome={mergeWelcome} onDismiss={acknowledge}/>;

  if (!updates.length) return error ? <div className="updates-retry wrap" role="status">
    {error} <button type="button" onClick={() => void load()}>Try again</button> <a href="/updates">Read the updates</a>
  </div> : null;

  return <dialog ref={dialog} className="updates-dialog" aria-labelledby="updates-title" aria-describedby="updates-description">
    <header className="updates-heading"><p className="eyebrow">A quick note from camp</p><h1 id="updates-title">What&apos;s new in Outlast?</h1><p id="updates-description">Please review these updates, then tap the button below. We&apos;ll remember your confirmation on all your devices.</p></header>
    {/* Keyboard users need a focusable scroll region to read the whole notice. */}
    {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
    <div className="updates-scroll" role="region" tabIndex={0} aria-label="League updates">
      {updates.map(update => <UpdateSections key={update.id} update={update}/>)}
    </div>
    <div className="updates-actions">
      {error && <p role="alert">{error}</p>}
      <button className="button button-primary" type="button" disabled={saving} onClick={() => void acknowledge()}>{saving ? "Saving your confirmation…" : "Got it — continue"}</button>
      <small>You can read these again using What&apos;s new at the top of the page.</small>
    </div>
  </dialog>;
}
