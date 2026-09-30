"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Answer = "Yes" | "No" | "Skip";
type Vote = { answer: Answer; votedAt: string };
export type PopupQuestion = {
  id: string; question: string; details: string; creditName: string | null;
  opensAt: string; closesAt: string; points: 3;
  status: "open" | "closed" | "pending" | "resolved" | "void";
  vote: Vote | null; correctAnswer: "Yes" | "No" | null;
  earnedPoints: 0 | 3; revealAt: string | null;
};

function dateLabel(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Detroit",
  }) + " ET";
}

function canAnswer(question: PopupQuestion, now: number) {
  return question.status === "open" && !question.vote &&
    now >= new Date(question.opensAt).getTime() && now < new Date(question.closesAt).getTime();
}

function isVote(value: unknown): value is Vote {
  if (!value || typeof value !== "object") return false;
  const vote = value as Record<string, unknown>;
  return ["Yes", "No", "Skip"].includes(String(vote.answer)) && typeof vote.votedAt === "string";
}

export function PopupQuestions({ enabled = true, mode = "popup" }: { enabled?: boolean; mode?: "popup" | "page" }) {
  const [questions, setQuestions] = useState<PopupQuestion[] | null>(null);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [now, setNow] = useState(0);
  const requests = useRef({ value: 0 });
  const clockOffset = useRef(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);

  const load = useCallback(async () => {
    if (submitting.current || document.visibilityState !== "visible") return;
    const request = ++requests.current.value;
    try {
      const response = await fetch("/api/popup-questions", { cache: "no-store" });
      const data = await response.json();
      if (request !== requests.current.value) return;
      if (response.status === 401 || response.status === 403) { setQuestions([]); setError(""); return; }
      if (!response.ok || !Array.isArray(data.questions)) throw new Error(data.error || "Bonus questions could not load.");
      const serverTime = new Date(data.serverNow).getTime();
      clockOffset.current = Number.isFinite(serverTime) ? serverTime - Date.now() : 0;
      setNow(Date.now() + clockOffset.current);
      setQuestions(data.questions);
      setError("");
    } catch {
      if (request === requests.current.value) setError("Bonus questions could not load. Please try again.");
    }
  }, []);

  useEffect(() => {
    const counter = requests.current;
    // State changes only after the awaited server response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", load);
    const timer = window.setInterval(() => setNow(Date.now() + clockOffset.current), 1000);
    return () => {
      counter.value++;
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", load);
      window.clearInterval(timer);
    };
  }, [load]);

  const available = (questions || []).filter(question => canAnswer(question, now));
  const active = available.find(question => !dismissed.includes(question.id));
  const activeId = active?.id;
  const showDialog = mode === "popup" && enabled && Boolean(active);

  useEffect(() => {
    const element = dialog.current;
    if (!element || !showDialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const cancel = (event: Event) => {
      event.preventDefault();
      if (!submitting.current && activeId) setDismissed(ids => [...ids, activeId]);
    };
    element.addEventListener("cancel", cancel);
    if (!element.open) element.showModal();
    return () => {
      element.removeEventListener("cancel", cancel);
      element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [showDialog, activeId]);

  function dismiss() {
    if (submitting.current || !active) return;
    setDismissed(ids => [...ids, active.id]);
  }

  async function submit(question: PopupQuestion, answer: Answer): Promise<string | null> {
    if (submitting.current) return "Your answer is still saving.";
    submitting.current = true;
    requests.current.value++; // A stale read must never erase a successful vote receipt.
    try {
      const response = await fetch("/api/popup-questions", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ questionId: question.id, answer }),
      });
      const data = await response.json();
      if ((response.ok || response.status === 409) && isVote(data.vote)) {
        const vote = data.vote;
        setQuestions(items => items?.map(item => item.id === question.id ? { ...item, vote } : item) || []);
        setError("");
        setReceipt(vote.answer !== answer ? `Your account already recorded ${vote.answer === "Skip" ? "a skip" : vote.answer} for this question. That original response remains final.` : vote.answer === "Skip" ? "Skip recorded. This question will not appear again." : `Your final answer is recorded: ${vote.answer}.`);
        return null;
      }
      return data.error || "Your answer wasn't saved. Your selection is still here; please try again.";
    } catch {
      return "We couldn't confirm your answer. Your selection is still here. Try again to check or save the same answer.";
    } finally {
      submitting.current = false;
    }
  }

  if (mode === "page") return <div className="popup-question-history">
    {receipt && <p className="popup-question-receipt" role="status">{receipt}</p>}
    {error && <p className="notice" role="alert">{error} <button type="button" onClick={() => void load()}>Try again</button></p>}
    {questions === null && !error && <p role="status">Loading bonus questions…</p>}
    {questions?.length === 0 && <div className="notice">No bonus questions have been published yet.</div>}
    {questions?.map(question => <article key={question.id} className="popup-question-card">
      <QuestionHeading question={question}/>
      {canAnswer(question, now) ? <QuestionVoteForm key={question.id} question={question} submit={submit}/> : <QuestionRecord question={question}/>}
    </article>)}
  </div>;

  if (questions?.length === 0) return null;
  if (!questions) return error ? <div className="popup-question-bar wrap" role="status">{error} <button type="button" onClick={() => void load()}>Try again</button></div> : null;
  return <>
    {receipt && <p className="popup-question-receipt wrap" role="status">{receipt}</p>}
    <div className="popup-question-bar wrap">
      <span>{available.length ? `${available.length === 1 ? "A bonus question is" : `${available.length} bonus questions are`} open · +3 for a correct answer` : "View your bonus questions, answers, and points."}</span>
      {available.length > 0 && <button type="button" onClick={() => setDismissed([])} disabled={!enabled}>Answer bonus question</button>}
      <a href="/popup-questions">Bonus questions &amp; history</a>
    </div>
    {showDialog && active && <dialog ref={dialog} className="popup-question-dialog" aria-labelledby="popup-question-title" aria-describedby="popup-question-rules">
      <div className="popup-question-dialog-scroll">
        <QuestionHeading question={active} titleId="popup-question-title"/>
        <QuestionVoteForm key={active.id} question={active} submit={submit} rulesId="popup-question-rules" onLater={dismiss}/>
      </div>
    </dialog>}
  </>;
}

function QuestionHeading({ question, titleId }: { question: PopupQuestion; titleId?: string }) {
  return <header className="popup-question-heading">
    <p className="eyebrow">Season bonus · +3 points</p>
    <h2 id={titleId}>{question.question}</h2>
    {question.details && <p className="popup-question-details">{question.details}</p>}
    {question.creditName && <p className="popup-question-credit">Inspired by {question.creditName}&apos; Campfire suggestion.</p>}
    <p className="popup-question-deadline">Answers close {dateLabel(question.closesAt)}</p>
  </header>;
}

function QuestionVoteForm({ question, submit, rulesId, onLater }: {
  question: PopupQuestion; submit: (question: PopupQuestion, answer: Answer) => Promise<string | null>;
  rulesId?: string; onLater?: () => void;
}) {
  const [answer, setAnswer] = useState<Answer | "">("");
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState("");
  const confirmationTitle = useRef<HTMLHeadingElement>(null);
  const saveGuard = useRef(false);

  useEffect(() => {
    if (reviewing) confirmationTitle.current?.focus();
  }, [reviewing]);

  async function confirm() {
    if (!answer || saveGuard.current) return;
    saveGuard.current = true;
    setAttempted(true);
    setSaving(true);
    setError("");
    const failure = await submit(question, answer);
    if (failure) setError(failure);
    saveGuard.current = false;
    setSaving(false);
  }

  return <div className="popup-question-vote">
    <p id={rulesId}>One final answer per account. Correct: +3 points. Wrong or skipped: 0. This is separate from your weekly picks.</p>
    {reviewing ? <div className="popup-question-confirm" aria-live="polite">
      <h3 ref={confirmationTitle} tabIndex={-1}>{answer === "Skip" ? "Skip this question?" : `Submit ${answer} as your final answer?`}</h3>
      <p>{answer === "Skip" ? "You will earn 0 points and cannot answer this question later." : "You cannot change your answer after submitting, even on another device."}</p>
      <div className="popup-question-actions">
        <button type="button" className="button button-primary" disabled={saving} onClick={() => void confirm()}>{saving ? "Saving…" : answer === "Skip" ? "Confirm skip — 0 points" : `Submit ${answer} — final answer`}</button>
        <button type="button" className="button button-ghost" disabled={saving || attempted} onClick={() => { setReviewing(false); setError(""); }}>Go back</button>
      </div>
    </div> : <>
      <fieldset className="popup-question-choices"><legend>Choose your answer</legend>{(["Yes", "No"] as const).map(option => <label key={option}><input type="radio" name={`popup-answer-${question.id}`} value={option} checked={answer === option} onChange={() => setAnswer(option)}/><span>{option}</span></label>)}</fieldset>
      <div className="popup-question-actions"><button type="button" className="button button-primary" disabled={!answer || answer === "Skip"} onClick={() => setReviewing(true)}>Review my answer</button><button type="button" className="button button-ghost" onClick={() => { setAnswer("Skip"); setReviewing(true); }}>Skip this question — 0 points</button></div>
    </>}
    {error && <p className="popup-question-error" role="alert">{error} Retry keeps the same final answer.</p>}
    {onLater && <button type="button" className="popup-question-later" disabled={saving} onClick={onLater}>Not now — remind me next visit</button>}
  </div>;
}

function QuestionRecord({ question }: { question: PopupQuestion }) {
  return <div className="popup-question-record">
    <p><strong>{question.vote ? question.vote.answer === "Skip" ? "You skipped this question." : `Your final answer: ${question.vote.answer}` : "You did not answer this question."}</strong>{question.vote && <span> Recorded {dateLabel(question.vote.votedAt)}</span>}</p>
    {question.status === "resolved" ? <p>Correct answer: <strong>{question.correctAnswer}</strong> · <strong>{question.earnedPoints ? "+3 points" : "0 points"}</strong></p> : question.status === "void" ? <p>This question was voided. All answers earn 0 points.</p> : <p>{question.status === "pending" ? `Opens ${dateLabel(question.opensAt)}.` : question.status === "open" ? "Results will appear here after the question is resolved." : "Answers are closed. Results are not available yet."}{question.revealAt && ` Results reveal ${dateLabel(question.revealAt)}.`}</p>}
  </div>;
}
