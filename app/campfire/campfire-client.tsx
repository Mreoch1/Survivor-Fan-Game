"use client";

import { useEffect, useState } from "react";
import { profileIcon } from "../profile-icons";

type Post = { id: number; body: string; createdAt: string; name: string; teamName: string; avatarKey: string };

export function CampfireClient() {
  const [posts, setPosts] = useState<Post[]>([]), [body, setBody] = useState(""), [busy, setBusy] = useState(false), [locked, setLocked] = useState(false), [revealAt, setRevealAt] = useState<string | null>(null), [error, setError] = useState("");
  const load = () => fetch("/api/posts").then((response) => response.json()).then((data) => { setPosts(data.posts || []); setLocked(!!data.locked); setRevealAt(data.revealAt || null); });
  useEffect(() => { load(); }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    const response = await fetch("/api/posts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body }) }), output = await response.json();
    setBusy(false); if (response.ok) { setBody(""); await load(); } else setError(output.error || "That message could not be posted.");
  }

  return <><div className="notice"><strong>Spoiler-safe campfire</strong><span>{locked && revealAt ? `Posting reopens ${new Date(revealAt).toLocaleString("en-US", { weekday: "long", hour: "numeric", minute: "2-digit", timeZone: "America/Detroit" })} ET.` : "Please keep future-episode spoilers out of the chat."}</span></div><div className="campfire-layout"><form className="panel post-box" onSubmit={submit}><label htmlFor="post">Add to the campfire</label><textarea id="post" maxLength={500} required disabled={locked} value={body} onChange={(event) => setBody(event.target.value)} placeholder={locked ? "Campfire is quiet during the spoiler window." : "I’m calling a blindside this week…"} />{error && <p>{error}</p>}<div><small>{body.length}/500</small><button className="button button-primary" disabled={busy || locked}>{busy ? "Posting…" : locked ? "Spoiler window" : "Post message"}</button></div></form><section className="post-feed">{posts.length ? posts.map((post) => <article className="post" key={post.id}><div className="avatar small" aria-label={`${profileIcon(post.avatarKey).label} icon`}>{profileIcon(post.avatarKey).symbol}</div><div><header><strong>{post.teamName || post.name}</strong><time>{new Date(post.createdAt).toLocaleString()}</time></header><p>{post.body}</p></div></article>) : <div className="notice">The campfire is quiet. Start the conversation.</div>}</section></div></>;
}
