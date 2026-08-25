"use client";

import { useEffect, useState } from "react";
import { profileIcons, type ProfileIconKey } from "../profile-icons";

type PlayerProfile = { displayName: string; teamName: string; avatarKey: ProfileIconKey; updatedAt: string; email: string };

export function ProfileClient() {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [avatarKey, setAvatarKey] = useState<ProfileIconKey>("torch");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetch("/api/profile").then(async (response) => { const body = await response.json(); if (!response.ok) { setError(body.error || "Your profile could not be loaded"); return; } const next = body.profile as PlayerProfile; setProfile(next); setDisplayName(next.displayName); setTeamName(next.teamName); setAvatarKey(next.avatarKey); }); }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setSaved("");
    const response = await fetch("/api/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName, teamName, avatarKey }) });
    const body = await response.json(); setSaving(false);
    if (!response.ok) { setError(body.error || "Your profile was not saved"); return; }
    const next = body.profile as PlayerProfile; setProfile(next); setDisplayName(next.displayName); setTeamName(next.teamName); setAvatarKey(next.avatarKey); setSaved(next.updatedAt);
  }

  if (!profile && !error) return <div className="loading"><p className="eyebrow">Finding your torch…</p></div>;
  const changed = !!profile && (displayName !== profile.displayName || teamName !== profile.teamName || avatarKey !== profile.avatarKey);
  const selected = profileIcons.find((icon) => icon.key === avatarKey) ?? profileIcons[0];

  return <form className="profile-card" onSubmit={save}>
    <aside className="profile-preview" aria-label="Player profile preview"><span className="profile-avatar" aria-hidden="true">{selected.symbol}</span><p className="eyebrow">League preview</p><h2>{teamName.trim() || displayName.trim() || "Your team"}</h2><p>{teamName.trim() ? displayName.trim() : "Player profile"}</p></aside>
    <div className="profile-fields">
      {error && <div className="notice" role="alert"><strong>{error}</strong></div>}
      {saved && <div className="notice profile-success" role="status"><strong>✓ Profile saved</strong><span>Updated {new Date(saved).toLocaleString("en-US", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Detroit" })} ET</span></div>}
      <label htmlFor="profile-email">Email <small>(account login)</small></label><input id="profile-email" value={profile?.email || ""} disabled />
      <label htmlFor="profile-name">Player name</label><input id="profile-name" required maxLength={40} value={displayName} onChange={(event) => { setDisplayName(event.target.value); setSaved(""); }} />
      <label htmlFor="profile-team">Team name <small>(optional)</small></label><input id="profile-team" maxLength={50} value={teamName} onChange={(event) => { setTeamName(event.target.value); setSaved(""); }} placeholder="The Torch Snuffers" />
      <fieldset><legend>Choose your island icon</legend><div className="profile-icons">{profileIcons.map((icon) => <label className="profile-icon" key={icon.key}><input type="radio" name="avatar" value={icon.key} checked={avatarKey === icon.key} onChange={() => { setAvatarKey(icon.key); setSaved(""); }} /><span aria-hidden="true">{icon.symbol}</span><strong>{icon.label}</strong></label>)}</div></fieldset>
      <div className="profile-actions"><button className="button button-primary" disabled={saving || !displayName.trim() || !changed}>{saving ? "Saving…" : saved ? "Saved ✓" : "Save profile"}</button><a className="button button-ghost" href="/play">Back to picks</a></div>
    </div>
  </form>;
}
