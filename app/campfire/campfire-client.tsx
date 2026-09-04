"use client";

import { useEffect, useMemo, useState } from "react";
import { profileIcon } from "../profile-icons";

type Reply = { id: number; body: string; createdAt: string; name: string; teamName: string; avatarKey: string };
type Thread = Reply & { upvotes: number; downvotes: number; score: number; myVote: -1 | 0 | 1; replies: Reply[] };

function playerName(post: Reply) {
  return post.teamName || post.name;
}

function postedAt(value: string) {
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function CampfireClient() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [votingPost, setVotingPost] = useState<number | null>(null);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replying, setReplying] = useState(false);
  const [sort, setSort] = useState<"top" | "newest">("top");
  const [locked, setLocked] = useState(false);
  const [revealAt, setRevealAt] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = () => fetch("/api/posts").then(async (response) => {
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "The Campfire could not load.");
      return;
    }
    setThreads(data.threads || []);
    setLocked(Boolean(data.locked));
    setRevealAt(data.revealAt || null);
  });
  useEffect(() => { load(); }, []);

  const sortedThreads = useMemo(() => [...threads].sort((a, b) => sort === "top"
    ? b.score - a.score || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [threads, sort]);

  async function submitIdea(event: React.FormEvent) {
    event.preventDefault();
    setPosting(true);
    setError("");
    const response = await fetch("/api/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const output = await response.json();
    setPosting(false);
    if (response.ok) {
      setBody("");
      setSort("newest");
      await load();
    } else setError(output.error || "That idea could not be posted.");
  }

  async function submitReply(event: React.FormEvent, parentPostId: number) {
    event.preventDefault();
    setReplying(true);
    setError("");
    const response = await fetch("/api/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: replyBody, parentPostId }),
    });
    const output = await response.json();
    setReplying(false);
    if (response.ok) {
      setReplyBody("");
      setReplyingTo(null);
      await load();
    } else setError(output.error || "That reply could not be posted.");
  }

  async function vote(post: Thread, nextVote: -1 | 1) {
    setVotingPost(post.id);
    setError("");
    const voteValue = post.myVote === nextVote ? 0 : nextVote;
    const response = await fetch("/api/posts", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postId: post.id, vote: voteValue }),
    });
    const output = await response.json();
    setVotingPost(null);
    if (response.ok) await load();
    else setError(output.error || "Your vote could not be counted.");
  }

  function toggleReply(postId: number) {
    setReplyingTo((current) => current === postId ? null : postId);
    setReplyBody("");
  }

  return <>
    <div className="campfire-banner"><span aria-hidden="true">🔥</span><div><p className="eyebrow">The tribe shapes the game</p><h2>Pitch an idea. Build the conversation.</h2><p>Each idea keeps its replies together, so the discussion never gets separated. Vote on the main idea to help the best twists rise.</p></div></div>
    <div className="notice"><strong>Spoiler-safe Campfire</strong><span>{locked && revealAt ? `Ideas, replies, and voting reopen ${new Date(revealAt).toLocaleString("en-US", { weekday: "long", hour: "numeric", minute: "2-digit", timeZone: "America/Detroit" })} ET.` : "Keep future-episode spoilers away from the fire."}</span></div>
    {error && <div className="notice campfire-error" role="alert"><strong>{error}</strong></div>}
    <div className="campfire-layout">
      <form className="panel post-box" onSubmit={submitIdea}>
        <label htmlFor="post">Start a new Campfire idea</label>
        <p>Suggest a rule, scoring twist, challenge, or anything that could make the league more fun. Replies belong under an existing idea.</p>
        <textarea id="post" maxLength={500} required disabled={locked} value={body} onChange={(event) => setBody(event.target.value)} placeholder={locked ? "The Campfire is quiet during the spoiler window." : "My idea for the game is…"} />
        <div><small>{body.length}/500</small><button className="button button-primary" disabled={posting || locked}>{posting ? "Posting…" : locked ? "Spoiler window" : "Post new idea"}</button></div>
      </form>
      <section className="post-feed" aria-label="Campfire ideas and replies">
        <div className="campfire-feed-tools"><div><p className="eyebrow">Campfire board</p><h2>{threads.length} {threads.length === 1 ? "idea" : "ideas"}</h2></div><div className="campfire-sort" aria-label="Sort Campfire ideas"><button type="button" aria-pressed={sort === "top"} onClick={() => setSort("top")}>Top ideas</button><button type="button" aria-pressed={sort === "newest"} onClick={() => setSort("newest")}>Newest</button></div></div>
        {sortedThreads.length ? sortedThreads.map((post) => <article className="post idea-thread" key={post.id}>
          <div className="avatar small" aria-label={`${profileIcon(post.avatarKey).label} icon`}>{profileIcon(post.avatarKey).symbol}</div>
          <div className="idea-content">
            <header><strong>{playerName(post)}</strong><time>{postedAt(post.createdAt)}</time></header>
            <p>{post.body}</p>
            <div className="post-votes">
              <span className="tribe-score"><small>Tribe Score</small><strong>{post.score > 0 ? `+${post.score}` : post.score}</strong></span>
              <button type="button" aria-label={`Upvote idea by ${playerName(post)}`} aria-pressed={post.myVote === 1} className={post.myVote === 1 ? "voted" : ""} disabled={locked || votingPost === post.id} onClick={() => vote(post, 1)}><span aria-hidden="true">▲</span> Upvote <strong>{post.upvotes}</strong></button>
              <button type="button" aria-label={`Downvote idea by ${playerName(post)}`} aria-pressed={post.myVote === -1} className={post.myVote === -1 ? "voted down" : ""} disabled={locked || votingPost === post.id} onClick={() => vote(post, -1)}><span aria-hidden="true">▼</span> Downvote <strong>{post.downvotes}</strong></button>
              <button type="button" className="reply-button" aria-expanded={replyingTo === post.id} onClick={() => toggleReply(post.id)} disabled={locked}>↳ Reply <strong>{post.replies.length}</strong></button>
            </div>
            {(post.replies.length > 0 || replyingTo === post.id) && <section className="reply-thread" aria-label={`Replies to ${playerName(post)}'s idea`}>
              {post.replies.map((reply) => <article className="campfire-reply" key={reply.id}>
                <div className="avatar small" aria-label={`${profileIcon(reply.avatarKey).label} icon`}>{profileIcon(reply.avatarKey).symbol}</div>
                <div><header><strong>{playerName(reply)}</strong><time>{postedAt(reply.createdAt)}</time></header><p>{reply.body}</p></div>
              </article>)}
              {replyingTo === post.id && <form className="reply-form" onSubmit={(event) => submitReply(event, post.id)}><label htmlFor={`reply-${post.id}`}>Reply under {playerName(post)}’s idea</label><textarea id={`reply-${post.id}`} required maxLength={500} value={replyBody} onChange={(event) => setReplyBody(event.target.value)} placeholder="Add to this conversation…" /><div><small>{replyBody.length}/500</small><span><button type="button" className="button button-ghost" onClick={() => toggleReply(post.id)}>Cancel</button><button className="button button-primary" disabled={replying}>{replying ? "Posting…" : "Post reply"}</button></span></div></form>}
            </section>}
          </div>
        </article>) : <div className="notice">The Campfire is quiet. Bring the first idea to the fire.</div>}
      </section>
    </div>
  </>;
}
