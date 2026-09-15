"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LeagueUpdate } from "../../lib/league-updates";
import { UpdateSections } from "./UpdateSections";

export function LeagueUpdates() {
  const [updates, setUpdates] = useState<LeagueUpdate[]>([]);
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
      if (response.status === 401) { setUpdates([]); setError(""); return; }
      if (!response.ok) throw new Error("Updates could not load");
      const data = await response.json();
      if (request !== requestNumber.current.value) return;
      setUpdates(data.updates);
      setError("");
    } catch {
      if (request === requestNumber.current.value) setError("We couldn't load the latest updates. Please try again.");
    }
  }, []);

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

  useEffect(() => {
    const element = dialog.current;
    if (!element || !updates.length) return;
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
  }, [updates.length]);

  async function acknowledge() {
    if (savingRef.current) return;
    savingRef.current = true;
    requestNumber.current.value++; // An older read must not reopen a confirmed notice.
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/updates", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ updateIds: updates.map(update => update.id) }),
      });
      if (!response.ok) throw new Error("Confirmation was not saved");
      setUpdates([]);
    } catch {
      setError("Your confirmation wasn't saved. Please tap the button to try again.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

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
      <button className="button button-primary" type="button" disabled={saving} onClick={acknowledge}>{saving ? "Saving your confirmation…" : "Got it — continue"}</button>
      <small>You can read these again using What&apos;s new at the top of the page.</small>
    </div>
  </dialog>;
}
