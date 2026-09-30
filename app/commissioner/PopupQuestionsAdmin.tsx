"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PopupQuestion } from "../../lib/popup-questions";

type AdminQuestion = PopupQuestion & { votesCount: number; canResolve: boolean };
type Episode = { id: number; title: string; resultsPosted: boolean; revealAt: string };
type AdminData = { questions: AdminQuestion[]; episodes: Episode[] };
type Draft = { id: string; question: string; details: string; creditName: string; opensAt: string; closesAt: string };

function easternDate(value: string) {
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Detroit" }) + " ET";
}

export function PopupQuestionsAdmin() {
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const guard = useRef(false);
  const requestNumber = useRef({ value: 0 });
  const form = useRef<HTMLFormElement>(null);
  const reviewTitle = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (draft) reviewTitle.current?.focus();
  }, [draft]);

  const load = useCallback(async () => {
    const request = ++requestNumber.current.value;
    try {
      const response = await fetch("/api/admin/popup-questions", { cache: "no-store" });
      const body = await response.json();
      if (request !== requestNumber.current.value) return;
      if (!response.ok || !Array.isArray(body.questions) || !Array.isArray(body.episodes)) throw new Error(body.error || "Bonus controls could not load.");
      setData(body);
      setError("");
    } catch {
      if (request === requestNumber.current.value) setError("Bonus controls could not load. Please try again.");
    }
  }, []);

  useEffect(() => {
    const counter = requestNumber.current;
    // Commissioner controls are populated by this asynchronous authorized server read.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    return () => { counter.value++; };
  }, [load]);

  function review(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const opensAt = new Date(String(values.get("opensAt")));
    const closesAt = new Date(String(values.get("closesAt")));
    if (!Number.isFinite(opensAt.getTime()) || !Number.isFinite(closesAt.getTime()) || opensAt >= closesAt) {
      setMessage("Choose a closing time after the opening time.");
      return;
    }
    setDraft({ id: crypto.randomUUID(), question: String(values.get("question") || "").trim(), details: String(values.get("details") || "").trim(), creditName: String(values.get("creditName") || "").trim(), opensAt: opensAt.toISOString(), closesAt: closesAt.toISOString() });
    setMessage("");
    setUncertain(false);
  }

  async function publish() {
    if (!draft || guard.current) return;
    guard.current = true;
    requestNumber.current.value++;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/popup-questions", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create", ...draft }),
      });
      const body = await response.json();
      if (!response.ok) {
        setUncertain(response.status >= 500);
        setMessage(body.error || "The question was not published. Please try again.");
        return;
      }
      setDraft(null);
      setUncertain(false);
      form.current?.reset();
      setMessage("Question published. It will appear to players when its opening time arrives.");
      await load();
    } catch {
      setUncertain(true);
      setMessage("Publication could not be confirmed. Retry this same question to check or finish publishing it without creating a duplicate.");
    } finally {
      guard.current = false;
      setSaving(false);
    }
  }

  return <section className="popup-question-admin" aria-labelledby="popup-admin-title">
    <header><p className="eyebrow">Extra season points</p><h2 id="popup-admin-title">Bonus questions</h2><p>Create a separate Yes/No question worth 3 points for a correct answer and 0 for a wrong answer or skip. Players get one final answer per question. Weekly Play Your Advantage picks keep their existing rules.</p></header>
    {error && <p className="notice" role="alert">{error} <button type="button" onClick={() => void load()}>Try again</button></p>}
    {!data && !error && <p role="status">Loading bonus controls…</p>}
    {data && <div className="popup-question-admin-grid">
      <form ref={form} className="admin-card" onSubmit={review}>
        <h3>Publish a new question</h3><p>State the exact episodes, qualifying event, and exclusions. Question wording, deadline, and credit cannot be changed after publishing.</p>
        <fieldset disabled={Boolean(draft) || saving} className="popup-question-admin-fields">
          <label>Yes/No question<textarea name="question" required maxLength={400} placeholder="During Episode N, will…?"/></label>
          <label>What counts and what does not<textarea name="details" required maxLength={2000} placeholder="Describe the exact event, time window, and exclusions."/></label>
          <label>Campfire credit <small>Optional; use the player’s display name.</small><input name="creditName" maxLength={100}/></label>
          <label>Opens<input name="opensAt" type="datetime-local" required/></label>
          <label>Answers close<input name="closesAt" type="datetime-local" required/></label>
          <small>Enter times in your device’s local time zone. The review below shows Eastern Time.</small>
          {!draft && <button type="submit" className="button button-primary">Review question</button>}
        </fieldset>
        {draft && <div className="popup-question-admin-review" aria-live="polite">
          <h4 ref={reviewTitle} tabIndex={-1}>{draft.question}</h4><p className="popup-question-details">{draft.details}</p>{draft.creditName && <p>Credit: {draft.creditName}</p>}<p>Opens {easternDate(draft.opensAt)}<br/>Closes {easternDate(draft.closesAt)}</p><p><strong>Publishing is final.</strong> Players can submit one answer or skip. Correct answers earn +3 points.</p>
          <div className="popup-question-actions"><button type="button" className="button button-primary" disabled={saving} onClick={() => void publish()}>{saving ? "Publishing…" : uncertain ? "Retry same publication" : "Publish question"}</button><button type="button" className="button button-ghost" disabled={saving || uncertain} onClick={() => setDraft(null)}>Edit before publishing</button></div>
        </div>}
        {message && <p className="popup-question-admin-status" role="status">{message}</p>}
      </form>
      <div className="admin-card"><h3>Questions &amp; results</h3><p>Resolve a question after answers close and the deciding episode’s results are entered. The answer and points stay private until a Monday reveal. For a question spanning several episodes, resolve No only after the entire stated window ends. For the Episode 3–through–finale injury question, No must wait until the finale; Yes requires a qualifying permanent medical removal because of an injury.</p>
        {data.questions.length === 0 && <p>No bonus questions have been published.</p>}
        <div className="popup-question-admin-list">{data.questions.map(question => <article key={question.id}>
          <h4>{question.question}</h4><p>{question.votesCount} recorded {question.votesCount === 1 ? "response" : "responses"} · Closes {easternDate(question.closes_at)}</p>
          {question.status !== "open" ? <p><strong>{question.status === "void" ? "Voided · all answers earn 0" : `Final result: ${question.correct_answer}`}</strong>{question.reveal_at && <> · Reveal {easternDate(question.reveal_at)}</>}</p> : question.canResolve ? <ResolveQuestion question={question} episodes={data.episodes.filter(episode => episode.resultsPosted)} onSaved={load}/> : <p>Resolution is available after answers close and episode results are entered.</p>}
        </article>)}</div>
      </div>
    </div>}
  </section>;
}

function ResolveQuestion({ question, episodes, onSaved }: { question: AdminQuestion; episodes: Episode[]; onSaved: () => Promise<void> }) {
  const [answer, setAnswer] = useState<"" | "Yes" | "No" | "Void">("");
  const [episodeId, setEpisodeId] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const guard = useRef(false);
  const reviewPanel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reviewing) reviewPanel.current?.focus();
  }, [reviewing]);
  const episode = episodes.find(item => item.id === Number(episodeId));

  async function resolve() {
    if (!answer || !episode || guard.current) return;
    guard.current = true;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/popup-questions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "resolve", questionId: question.id, answer, episodeId: episode.id }) });
      const body = await response.json();
      if (!response.ok) {
        setUncertain(response.status >= 500);
        setMessage(body.error || "The result was not saved. Please try again.");
        return;
      }
      setMessage("Final result saved.");
      await onSaved();
    } catch {
      setUncertain(true);
      setMessage("The result could not be confirmed. Retry the same result to check or finish saving it.");
    } finally {
      guard.current = false;
      setSaving(false);
    }
  }

  return <form onSubmit={event => { event.preventDefault(); setReviewing(true); setMessage(""); }}>
    <fieldset disabled={reviewing || saving} className="popup-question-admin-fields">
      <label>Correct answer<select value={answer} required onChange={event => setAnswer(event.target.value as typeof answer)}><option value="">Choose…</option><option>Yes</option><option>No</option><option value="Void">Void — all answers earn 0</option></select></label>
      <label>Deciding episode<select value={episodeId} required onChange={event => setEpisodeId(event.target.value)}><option value="">Choose an episode with entered results…</option>{episodes.map(item => <option key={item.id} value={item.id}>{item.id} · {item.title}</option>)}</select></label>
      {!reviewing && <button className="button button-primary" type="submit">Review result</button>}
    </fieldset>
    {reviewing && episode && <div ref={reviewPanel} tabIndex={-1} className="popup-question-admin-review"><p><strong>{answer === "Void" ? "Void this question: everyone earns 0 points." : `Correct answer: ${answer}. Matching answers earn +3 points.`}</strong></p><p>Reveal no earlier than Episode {episode.id}’s reveal: {easternDate(episode.revealAt)}. If entered after that reveal, this waits until the next Monday, or today if it is Monday. This result cannot be changed.</p><div className="popup-question-actions"><button className="button button-primary" type="button" disabled={saving} onClick={() => void resolve()}>{saving ? "Saving…" : uncertain ? "Retry same result" : "Save final result"}</button><button className="button button-ghost" type="button" disabled={saving || uncertain} onClick={() => setReviewing(false)}>Go back</button></div></div>}
    {message && <p role="status" className="popup-question-admin-status">{message}</p>}
  </form>;
}
