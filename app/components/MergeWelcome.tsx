"use client";

import { useEffect, useRef, useState } from "react";
import { getMergeWelcomeCopy, type MergeWelcomeData } from "../../lib/merge-welcome";
import "./merge-welcome.css";

const deadlineFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  timeZone: "America/Detroit", timeZoneName: "short",
});

type MergeWelcomeProps = {
  welcome: MergeWelcomeData;
  onDismiss: (goToPicks: boolean) => Promise<void>;
};

export function MergeWelcome({ welcome, onDismiss }: MergeWelcomeProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { openingResult, finalTorchAdvice } = getMergeWelcomeCopy(welcome);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    title.current?.focus({ preventScroll: true });
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected && document.activeElement === document.body) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, []);

  async function dismiss(goToPicks: boolean) {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      await onDismiss(goToPicks);
    } catch {
      setError("We couldn’t save that you’ve seen this welcome. Please try again.");
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="merge-welcome"
      aria-labelledby="merge-welcome-title"
      aria-describedby="merge-welcome-intro"
      onCancel={event => { event.preventDefault(); void dismiss(false); }}
    >
      <header className="merge-welcome-hero">
        <h2 ref={title} tabIndex={-1} id="merge-welcome-title">You made the merge!</h2>
        <p id="merge-welcome-intro">Congratulations! The castaways are one tribe. For your Final Torch Pick, choose the one castaway you think will go all the way.</p>
        <svg className="merge-welcome-torch" viewBox="0 0 88 116" fill="none" aria-hidden="true" focusable="false">
          <path d="M42 66C19 65 19 47 22 37c4 7 7 8 10 8-4-18 13-26 12-40 15 13 11 26 10 32 6-2 9-9 10-13 13 22 2 43-22 42Z" fill="#ff9048"/>
          <path d="M44 63c-13 0-16-9-13-17 2 3 5 5 7 5-1-10 8-14 9-24 10 14 2 18 7 23l5-7c3 12-5 20-15 20Z" fill="#ffe49b"/>
          <path d="m31 68 27-3-7 18-12 1Z" fill="#e6bb68"/>
          <path d="m35 74 20-2m-17 8 15-2" stroke="#724b32" strokeWidth="3"/>
          <path d="m40 86 10-1-3 24-4 1Z" fill="#c08355"/>
          <path d="m23 20 1-6m39 1 3-5M12 43l-4-2m66-9 5-4" stroke="#ffd079" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </header>
      <div className="merge-welcome-content">
        <section>
          <h3>Your Opening Outlast Pick</h3>
          <p>{openingResult}</p>
        </section>
        <section>
          <h3>Your Final Torch Pick</h3>
          <p>{finalTorchAdvice}</p>
          <p className="merge-welcome-deadline">Final Torch locks <time dateTime={welcome.repickClosesAt}>{deadlineFormat.format(new Date(welcome.repickClosesAt))}</time>.</p>
        </section>
        {error && <p role="alert" className="merge-welcome-error">{error}</p>}
        <div className="merge-welcome-actions" aria-busy={saving}>
          <button type="button" disabled={saving} onClick={() => void dismiss(true)}>Go to my Final Torch pick <span aria-hidden="true">→</span></button>
          <button type="button" disabled={saving} onClick={() => void dismiss(false)}>Got it</button>
        </div>
      </div>
    </dialog>
  );
}
