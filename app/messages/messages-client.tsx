"use client";

import { useEffect, useMemo, useState } from "react";
import { profileIcon } from "../profile-icons";

type Member = { id: string; name: string; displayName: string; avatarKey: string };
type Conversation = Member & { otherId: string; latestBody: string; latestAt: string; unread: number };
type PrivateMessage = { id: number; senderId: string; body: string; readAt: string | null; createdAt: string };
type MessageData = {
  currentUserId: string;
  members: Member[];
  conversations: Conversation[];
  selectedMember: Member | null;
  messages: PrivateMessage[];
};

function messageTime(value: string) {
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function MessagesClient() {
  const [data, setData] = useState<MessageData | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [body, setBody] = useState("");
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function loadOverview() {
    const response = await fetch("/api/messages");
    const output = await response.json();
    if (!response.ok) {
      setError(output.error || "Private Messages could not load.");
      return;
    }
    const next = output as MessageData;
    setError("");
    setData(next);
    setSelectedId((current) => current || next.conversations[0]?.otherId || next.members[0]?.id || "");
  }

  async function loadConversation(memberId: string, quiet = false) {
    if (!quiet) setLoadingConversation(true);
    const response = await fetch(`/api/messages?with=${encodeURIComponent(memberId)}`);
    const output = await response.json();
    if (!quiet) setLoadingConversation(false);
    if (!response.ok) {
      setError(output.error || "That conversation could not load.");
      return;
    }
    const next = output as MessageData;
    next.conversations = next.conversations.map((conversation) => conversation.otherId === memberId ? { ...conversation, unread: 0 } : conversation);
    setError("");
    setData(next);
    const readResponse = await fetch("/api/messages", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ withUserId: memberId }),
    });
    if (!readResponse.ok) setError("New messages loaded, but their unread status could not be updated.");
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { loadOverview(); }, 0);
    return () => window.clearTimeout(initialLoad);
  }, []);
  useEffect(() => {
    if (!selectedId) return;
    const initialLoad = window.setTimeout(() => { loadConversation(selectedId); }, 0);
    const refresh = window.setInterval(() => { loadConversation(selectedId, true); }, 20000);
    return () => { window.clearTimeout(initialLoad); window.clearInterval(refresh); };
  }, [selectedId]);

  const orderedMembers = useMemo(() => {
    if (!data) return [];
    const conversations = new Map(data.conversations.map((conversation) => [conversation.otherId, conversation]));
    return [...data.members].sort((a, b) => {
      const aConversation = conversations.get(a.id);
      const bConversation = conversations.get(b.id);
      if (aConversation && bConversation) return new Date(bConversation.latestAt).getTime() - new Date(aConversation.latestAt).getTime();
      if (aConversation) return -1;
      if (bConversation) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [data]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedId) return;
    setSending(true);
    setError("");
    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recipientId: selectedId, body }),
    });
    const output = await response.json();
    setSending(false);
    if (!response.ok) {
      setError(output.error || "Your private message could not be sent.");
      return;
    }
    setBody("");
    await loadConversation(selectedId, true);
  }

  if (!data && !error) return <div className="loading"><p className="eyebrow">Listening for whispers…</p></div>;
  if (!data) return <div className="notice campfire-error" role="alert"><strong>{error}</strong></div>;
  const conversationMap = new Map(data.conversations.map((conversation) => [conversation.otherId, conversation]));
  const selected = data.members.find((member) => member.id === selectedId) || null;

  return <div className="whisper-network">
    <aside className="panel whisper-list">
      <div className="whisper-list-title"><div><p className="eyebrow">League members</p><h2>Conversations</h2></div><button type="button" aria-label="Refresh private messages" onClick={() => selectedId ? loadConversation(selectedId) : loadOverview()}>↻</button></div>
      {orderedMembers.length ? <div className="member-list">{orderedMembers.map((member) => {
        const conversation = conversationMap.get(member.id);
        return <button type="button" className={selectedId === member.id ? "member-row active" : "member-row"} aria-pressed={selectedId === member.id} onClick={() => { setError(""); setSelectedId(member.id); }} key={member.id}>
          <span className="avatar small" aria-hidden="true">{profileIcon(member.avatarKey).symbol}</span>
          <span><strong>{member.name}</strong><small>{conversation?.latestBody || `Start a message with ${member.displayName}`}</small></span>
          {conversation?.unread ? <b aria-label={`${conversation.unread} unread messages`}>{conversation.unread}</b> : conversation ? <time>{messageTime(conversation.latestAt)}</time> : null}
        </button>;
      })}</div> : <div className="whisper-empty"><span aria-hidden="true">🪶</span><p>No other players have joined the league yet.</p></div>}
    </aside>
    <section className="panel conversation-panel" aria-label={selected ? `Private conversation with ${selected.name}` : "Private conversation"}>
      {selected ? <>
        <header className="conversation-header"><span className="avatar" aria-hidden="true">{profileIcon(selected.avatarKey).symbol}</span><div><p className="eyebrow">Private conversation</p><h2>{selected.name}</h2><small>Only you and {selected.displayName} can see these messages.</small></div></header>
        <div className="message-scroll" aria-live="polite">{loadingConversation ? <div className="whisper-empty"><p>Opening conversation…</p></div> : data.messages.length ? data.messages.map((message) => {
          const mine = message.senderId === data.currentUserId;
          return <article className={mine ? "message-bubble mine" : "message-bubble"} key={message.id}><p>{message.body}</p><time>{messageTime(message.createdAt)}{mine && message.readAt ? " · Read" : ""}</time></article>;
        }) : <div className="whisper-empty"><span aria-hidden="true">🪶</span><h3>Start the whisper.</h3><p>Send the first private message to {selected.displayName}.</p></div>}</div>
        {error && <p className="message-error" role="alert">{error}</p>}
        <form className="message-composer" onSubmit={send}><label htmlFor="private-message">Message {selected.displayName}</label><textarea id="private-message" required maxLength={1000} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write a private message…" /><div><small>{body.length}/1,000</small><button className="button button-primary" disabled={sending || !body.trim()}>{sending ? "Sending…" : "Send privately"}</button></div></form>
      </> : <div className="whisper-empty"><span aria-hidden="true">🪶</span><h2>Select a league member.</h2><p>Your private conversation will open here.</p></div>}
    </section>
  </div>;
}
