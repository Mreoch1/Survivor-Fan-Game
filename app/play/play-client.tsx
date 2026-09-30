"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Countdown } from "../components/Countdown";
import { profileIcon } from "../profile-icons";
import { buildWeeklyPickPayload, getPickCompletion, getPickSaveState, isPickDirty, savePickRequest, type WeeklyPickDraft } from "../../lib/pick-form";

type Castaway={id:string;name:string;tribe:string;image:string;status:string;departureLabel?:"Voted out"|"Left the game"};
type Percent={value:string;count:number;percent:number};
type SeasonPick={openingGrace?:boolean;openingClosesAt?:string|null;stage:"opening"|"waiting"|"repick"|"locked";originalId:string;originalName:string|null;endgameId:string;endgameName:string|null;switched:boolean;individualGamePoints:number;endgamePoints:number;repickClosesAt:string|null;updatedAt:string|null};
type LeagueData={joined:boolean;profile?:{displayName:string;teamName:string;immunityStreak:number};episode:{id:number;title:string;airAt:string;lockAt:string;phase:string;bonusQuestion:string;bonusOptions:string[]};castaways:Castaway[];departedCastaways?:Castaway[];pick?:{favoriteId:string;immunityPick:string;bootPick:string;bonusPick:string;shotInTheDark:string;carriedFromEpisodeId:number|null;updatedAt:string};seasonPick:SeasonPick;leaderboard:{id:string;rank:number;name:string;teamName:string;avatarKey:string;points:number;popupPoints:number;badges:string[]}[];locked:boolean;preseasonLocked:boolean;pickPercentages:null|Record<string,Percent[]>;pendingReveal?:{id:number;title:string;revealAt:string};shotInTheDarkAvailable:boolean};

export function PlayClient() {
  const [data, setData] = useState<LeagueData | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(0);
  const [favorite, setFavorite] = useState("");
  const [immunity, setImmunity] = useState("");
  const [boot, setBoot] = useState("");
  const [bonus, setBonus] = useState("");
  const [shot, setShot] = useState("");
  const [openingPick, setOpeningPick] = useState("");
  const [endgamePick, setEndgamePick] = useState("");
  const [endgameSaving, setEndgameSaving] = useState(false);
  const [endgameMessage, setEndgameMessage] = useState("");
  const [endgameError, setEndgameError] = useState(false);

  const load = useCallback(() => fetch("/api/league").then(async response => {
    if (!response.ok) throw new Error("The league could not load. Please try again.");
    const next = await response.json() as LeagueData;
    setError("");
    setData(next);
    setNow(Date.now());
    setFavorite(next.pick?.favoriteId || "");
    setImmunity(next.pick?.immunityPick || "");
    setBoot(next.pick?.bootPick || "");
    setBonus(next.pick?.bonusPick || "");
    setShot(next.pick?.shotInTheDark || "");
    setOpeningPick(next.seasonPick?.originalId || "");
    setEndgamePick(next.seasonPick?.endgameId || "");
  }).catch(cause => {
    setError(cause instanceof Error ? cause.message : "The league could not load. Please try again.");
  }), []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (error && !data) return <div className="notice pick-load-error" role="alert"><p>{error}</p><button type="button" className="button button-primary" onClick={() => void load()}>Try again</button></div>;
  if (!data) return <div className="loading"><p className="eyebrow">Setting up camp…</p></div>;
  if (!data.joined) return <JoinForm onJoined={load}/>;

  const draft: WeeklyPickDraft = { favoriteId: favorite, immunityPick: immunity, bootPick: boot, bonusPick: bonus, shotInTheDark: shot, individualGamePick: openingPick };
  const deadlinePassed = data.locked || now >= Date.parse(data.episode.lockAt);
  const waitingForReveal = Boolean(data.pendingReveal);
  const revealReady = Boolean(data.pendingReveal && now >= Date.parse(data.pendingReveal.revealAt));
  const shotAvailable = data.shotInTheDarkAvailable || Boolean(data.pick?.shotInTheDark);
  const locked = deadlinePassed || waitingForReveal;
  const openingGrace = Boolean(data.seasonPick.openingGrace);
  const openingDeadline = Date.parse(data.seasonPick.openingClosesAt || "");
  const openingGraceExpired = openingGrace && (!Number.isFinite(openingDeadline) || now >= openingDeadline);
  const openingEditable = !data.preseasonLocked && !locked && !openingGraceExpired && (data.episode.id === 1 || openingGrace);
  const openingRequired = data.episode.id === 1 && !data.preseasonLocked;
  const completion = getPickCompletion(draft, openingRequired);
  const dirty = isPickDirty(draft, data.pick, data.seasonPick.originalId, openingRequired || openingEditable);
  const saveState = getPickSaveState(draft, data.pick, data.seasonPick.originalId, openingRequired, openingRequired || openingEditable);
  const endgameDirty = endgamePick !== data.seasonPick.endgameId;
  const endgameLocked = Boolean(data.seasonPick.repickClosesAt && now >= Date.parse(data.seasonPick.repickClosesAt));
  const favoriteCastaways = [...data.castaways, ...(data.departedCastaways || [])].sort((a, b) => a.name.localeCompare(b.name));
  const name = (id: string) => favoriteCastaways.find(c => c.id === id)?.name || id;
  const choice = (value: string) => value ? name(value) : "No pick yet";
  const immunityChoice = immunity ? (data.episode.phase === "individual" ? choice(immunity) : immunity) : "No pick yet";
  const shotChoice = shot === "immunity" ? `Immunity Pick · ${immunityChoice}` : shot === "boot" ? `Vote-Out Pick · ${choice(boot)}` : shot === "bonus" ? `Play Your Advantage · ${bonus || "No pick yet"}` : !shotAvailable ? "Already used this season" : "Saved for a later episode";
  const savedAt = data.pick && !data.pick.carriedFromEpisodeId ? formatPickTime(data.pick.updatedAt) : "";
  const missingText = completion.missing.map(item => item.label).join(", ");
  const statusTitle = waitingForReveal ? "Picks open after the results reveal" : deadlinePassed ? "Weekly picks locked" : saveState === "missing" ? `${completion.missing.length} required ${completion.missing.length === 1 ? "pick" : "picks"} to go` : saveState === "unsaved" ? "Unsaved changes" : saveState === "carried" ? "Carried forward · ready to review" : `Saved for Episode ${data.episode.id}`;
  const statusDetail = waitingForReveal ? "The previous episode is still spoiler-protected." : deadlinePassed ? (dirty ? "The deadline has passed. Any unsaved changes were not submitted." : completion.complete ? "Your picks on file are shown below." : `Missing at the deadline: ${missingText}.`) : saveState === "missing" ? `Choose ${missingText}, then save your picks.` : saveState === "unsaved" ? "Your selections below are not saved yet. Use Save picks when you’re ready." : saveState === "carried" ? `Eligible Episode ${data.pick?.carriedFromEpisodeId} picks are on file. Review them, make any changes, then save to confirm this week.` : `Saved ${savedAt}. You can change them until the deadline.`;

  async function save() {
    if (!data || saving || locked || !completion.complete) return;
    const submitted = buildWeeklyPickPayload(draft, data.episode.id, openingEditable, openingGrace);
    setSaving(true);
    setError("");
    try {
      const receipt = await savePickRequest("/api/picks", submitted);
      // Accept only this request's saved snapshot; newer edits remain in the form.
      setData(current => current && current.episode.id === submitted.episodeId ? {
        ...current,
        shotInTheDarkAvailable: current.shotInTheDarkAvailable || Boolean(current.pick?.shotInTheDark),
        preseasonLocked: openingGrace && Boolean(submitted.individualGamePick) ? true : current.preseasonLocked,
        pick: { favoriteId: submitted.favoriteId, immunityPick: submitted.immunityPick, bootPick: submitted.bootPick, bonusPick: submitted.bonusPick, shotInTheDark: submitted.shotInTheDark, carriedFromEpisodeId: null, updatedAt: receipt.updatedAt },
        seasonPick: submitted.individualGamePick === undefined ? current.seasonPick : { ...current.seasonPick, originalId: submitted.individualGamePick, originalName: current.castaways.find(c => c.id === submitted.individualGamePick)?.name || current.seasonPick.originalName, ...(openingGrace && submitted.individualGamePick ? { openingGrace: false, openingClosesAt: null, stage: "waiting" as const } : {}) },
      } : current);
      if (openingGrace && submitted.individualGamePick) setOpeningPick(submitted.individualGamePick);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Picks were not saved. Please try again.");
      if (openingGrace && submitted.individualGamePick) {
        // A one-time opening choice may have saved before a weekly/network failure.
        // Reconcile only that account state; keep all unsaved weekly selections.
        try {
          const response = await fetch("/api/league", { cache: "no-store" });
          if (response.ok) {
            const latest = await response.json() as LeagueData;
            if (latest.joined && latest.episode.id === submitted.episodeId && latest.seasonPick) {
              setData(current => current && current.episode.id === submitted.episodeId ? { ...current, preseasonLocked: latest.preseasonLocked, seasonPick: latest.seasonPick } : current);
              if (latest.seasonPick.originalId) setOpeningPick(latest.seasonPick.originalId);
            }
          }
        } catch { /* The original save error remains visible for a safe retry. */ }
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveEndgame() {
    if (!data || endgameSaving || endgameLocked) return;
    const submitted = endgamePick;
    setEndgameSaving(true);
    setEndgameMessage("");
    setEndgameError(false);
    try {
      const receipt = await savePickRequest("/api/endgame-pick", { castawayId: submitted });
      setData(current => current ? { ...current, seasonPick: { ...current.seasonPick, endgameId: submitted, endgameName: current.castaways.find(c => c.id === submitted)?.name || submitted, switched: Boolean(receipt.switched), updatedAt: receipt.updatedAt } } : current);
      setEndgameMessage("✓ Final Torch pick saved");
    } catch (cause) {
      setEndgameError(true);
      setEndgameMessage(cause instanceof Error ? cause.message : "Your Final Torch pick was not saved. Please try again.");
    } finally {
      setEndgameSaving(false);
    }
  }

  const seasonPanel = <SeasonPickPanel data={data} openingPick={openingPick} setOpeningPick={setOpeningPick} endgamePick={endgamePick} setEndgamePick={setEndgamePick} saveEndgame={saveEndgame} saving={endgameSaving} dirty={endgameDirty} message={endgameMessage} error={endgameError} locked={endgameLocked} openingLocked={!openingEditable || (openingGrace && saving)} openingWindowClosed={locked || openingGraceExpired}/>;

  return <>
    <section className="pick-round-header" aria-labelledby="pick-round-title">
      <div><p className="eyebrow">Episode {data.episode.id} · {data.episode.phase === "individual" ? "Individual game" : "Tribal game"}</p><h2 id="pick-round-title">{data.episode.title}</h2><p>Choose your {completion.total} required picks, then tap <strong>Save picks</strong>. Optional advantages are below.</p></div>
      <div className="pick-deadline"><p className="eyebrow">{waitingForReveal ? "Upcoming pick deadline" : deadlinePassed ? "Picks locked" : "Picks lock in"}</p>{!locked && <Countdown target={data.episode.lockAt}/>}<p>{formatPickTime(data.episode.lockAt)} ET</p></div>
    </section>
    {data.pendingReveal && <div className="notice"><strong>Episode {data.pendingReveal.id} results are spoiler-protected.</strong><span>{revealReady ? "The reveal time has arrived. Refresh to load results and open the next picks." : <>Scores and eliminations reveal {formatPickTime(data.pendingReveal.revealAt)} ET.</>}</span>{revealReady && <button type="button" className="button button-primary" onClick={() => void load()}>Refresh picks</button>}</div>}
    <section className={`pick-progress ${saveState === "saved" && !dirty ? "pick-progress-saved" : ""}`} aria-label="Pick completion">
      <div className="pick-progress-heading"><div><h2>{statusTitle}</h2><p>{statusDetail}</p></div><strong>{completion.selectedCount} of {completion.total} selected</strong></div>
      {data.pick?.carriedFromEpisodeId && saveState !== "carried" && !deadlinePassed && <p className="pick-carry-note">Some eligible picks carried forward from Episode {data.pick.carriedFromEpisodeId}. Missing picks need a fresh choice; optional advantages never carry forward.</p>}
      <ol className="pick-checklist">{completion.items.map((item, index) => <li key={item.id}><a href={`#${item.id}`} className={item.selected ? "pick-check-complete" : ""}><span aria-hidden="true">{item.selected ? "✓" : index + 1}</span><span>{item.label}<small>{item.selected ? "Selected" : "Choose a pick"}</small></span></a></li>)}</ol>
    </section>
    <div className="play-grid"><div className="pick-form-sections">
      <section className="panel" id="weekly-favorite" tabIndex={-1} aria-labelledby="favorite-heading">
        <div className="panel-title"><div><p className="eyebrow">Required · 1 point · +1 underdog bonus</p><h2 id="favorite-heading">1. Weekly Favorite</h2></div><span className="status-pill">{favorite ? "Selected" : "Needed"}</span></div>
        <p className="pick-help">Who will survive this episode? Earn an extra point if fewer than 20% of submitted favorites choose the same survivor.</p>
        {Boolean(data.departedCastaways?.length) && <p className="pick-help pick-departure-guide">A red X means this player has left the game and cannot be picked.</p>}
        <div className="pick-options">{favoriteCastaways.map(c => {
          const departed = c.status === "eliminated";
          const departureLabel = c.departureLabel || "Left the game";
          return <div className={`pick-option ${c.tribe.toLowerCase()}${departed ? " pick-option-departed" : ""}`} key={c.id}>
            <input aria-label={departed ? `${c.name}: ${departureLabel}. Not available for Weekly Favorite.` : `Choose ${c.name} as your Weekly Favorite Pick`} disabled={locked || departed} checked={favorite === c.id} onChange={() => { if (!locked && !departed) setFavorite(c.id); }} id={`fav-${c.id}`} name="favorite" type="radio"/>
            <label htmlFor={`fav-${c.id}`}><span className="avatar"><Image src={c.image} alt="" width={38} height={38}/>{departed && <span className="pick-departure-x" aria-hidden="true"><svg viewBox="0 0 100 100" focusable="false"><path d="M15 15L85 85M85 15L15 85"/></svg></span>}</span><span><strong>{c.name}</strong>{departed ? <small className="pick-departure-label">{departureLabel} · Cannot pick</small> : <small>{c.tribe === "Unassigned" ? "Tribe TBA" : c.tribe}</small>}</span></label>
          </div>;
        })}</div>
        <PickReceipt label="Weekly Favorite" value={choice(favorite)}/>
      </section>
      <section className="panel prediction-panel" id="weekly-immunity" tabIndex={-1} aria-labelledby="immunity-heading">
        <div className="panel-title"><div><p className="eyebrow">Required · 2 points</p><h2 id="immunity-heading">2. Immunity</h2></div><span className="status-pill">{immunity ? "Selected" : "Needed"}</span></div>
        <p className="pick-help">Who will win {data.episode.phase === "individual" ? "individual" : "tribal"} immunity this episode?</p>
        {data.episode.phase === "individual" ? <CastSelect id="immunity" label="Immunity Pick" value={immunity} setValue={setImmunity} cast={data.castaways} disabled={locked}/> : <div className="tribe-picks">{["Savu", "Toka"].map(tribe => <div className={`tribe-choice ${tribe.toLowerCase()}`} key={tribe}><input aria-label={`Choose ${tribe} as your Immunity Pick`} disabled={locked} checked={immunity === tribe} onChange={() => setImmunity(tribe)} id={`tribe-${tribe}`} name="immunity" type="radio"/><label htmlFor={`tribe-${tribe}`}><small>TRIBE</small><h3>{tribe}</h3></label></div>)}</div>}
        <PickReceipt label="Immunity" value={immunityChoice}/>
      </section>
      <section className="panel prediction-panel" id="weekly-vote-out" tabIndex={-1} aria-labelledby="boot-heading">
        <div className="panel-title"><div><p className="eyebrow">Required · 3 points</p><h2 id="boot-heading">3. Vote-Out</h2></div><span className="status-pill">{boot ? "Selected" : "Needed"}</span></div>
        <p className="pick-help">Who will be voted out at Tribal Council? Quits and medical removals do not count.</p>
        <CastSelect id="boot" label="Vote-Out Pick" value={boot} setValue={setBoot} cast={data.castaways} disabled={locked}/><PickReceipt label="Vote-Out" value={choice(boot)}/>
      </section>
      {(data.seasonPick.stage === "opening" || data.seasonPick.stage === "repick") && seasonPanel}
      <details className="panel pick-details">
        <summary><span><strong>Optional picks &amp; advantages</strong><small>Play Your Advantage: {bonus || "skipped"} · Shot in the Dark: {shot ? "selected" : shotAvailable ? "saved for later" : "already used"}</small></span></summary>
        <section className="pick-optional-section"><p className="eyebrow">Optional · Episode {data.episode.id} only · +1 / −1 point</p><h2>Play Your Advantage</h2><p className="pick-help"><strong>{data.episode.bonusQuestion}</strong></p><p className="pick-help">Correct: +1 point. Wrong: −1 point. Skip: 0 points. Choose fresh each week; this pick does not carry forward.</p><div className="bonus-options">{data.episode.bonusOptions.map(option => <button type="button" disabled={locked} aria-pressed={bonus === option} className={bonus === option ? "selected" : ""} onClick={() => setBonus(option)} key={option}>{option}</button>)}<button type="button" disabled={locked} aria-pressed={!bonus} className={`skip-option ${!bonus ? "selected" : ""}`} onClick={() => { setBonus(""); if (shot === "bonus") setShot(""); }}>Skip · 0 points</button></div><PickReceipt label="Advantage answer" value={bonus || "Skipped · 0 points"}/></section>
        <section className="pick-optional-section double-card"><div><p className="eyebrow">Optional advantage · one use all season</p><h2>Shot in the Dark</h2><p>Double the points from a correct Immunity, Vote-Out, or Play Your Advantage pick. A wrong Advantage answer still costs only 1 point. Your Shot is spent when this episode locks.</p></div><div><select aria-label="Choose which prediction gets your Shot in the Dark" disabled={locked || (!shotAvailable && !shot)} value={shot} onChange={event => setShot(event.target.value)}><option value="">{shotAvailable || shot ? "Save it for later" : "Already used this season"}</option><option value="immunity">Immunity Pick</option><option value="boot">Vote-Out Pick</option><option value="bonus" disabled={!bonus}>Play Your Advantage</option></select><PickReceipt label="Shot in the Dark" value={shotChoice}/></div></section>
      </details>
      {(data.seasonPick.stage === "waiting" || data.seasonPick.stage === "locked") && <details className="panel pick-details pick-season-details"><summary><span><strong>Your season pick · locked</strong><small>{data.seasonPick.endgameName || data.seasonPick.originalName || "No season pick on file"} · View pick and scoring rules</small></span></summary>{seasonPanel}</details>}
      <div className="save-bar sticky-save pick-save-bar">
        <div className={`save-message ${saveState === "saved" && !error ? "save-success" : ""}`} role="status" aria-live="polite"><strong>{error || (saving ? "Saving your picks…" : statusTitle)}</strong><small>{error ? "Your selections are still here." : locked ? `Episode ${data.episode.id}` : saveState === "saved" ? `Saved ${savedAt} ET` : `${completion.selectedCount} of ${completion.total} required picks selected`}</small></div>
        <button type="button" className="button button-primary" onClick={() => void save()} disabled={saving || locked || !completion.complete || (saveState === "saved" && !error)}>{saving ? "Saving…" : locked ? "Locked" : saveState === "saved" && !error ? "Saved ✓" : error ? "Try again" : "Save picks"}</button>
      </div>
    </div><aside className="pick-sidebar">
      <div className="panel leaderboard"><p className="eyebrow">Season standings</p><h2>Leaderboard</h2>{data.leaderboard.map(row => <div className="score-row" key={row.id}><span className="rank">{String(row.rank).padStart(2, "0")}</span><span className="avatar small" aria-label={`${profileIcon(row.avatarKey).label} icon`}>{profileIcon(row.avatarKey).symbol}</span><span className="leaderboard-name"><strong>{row.teamName || row.name}</strong>{row.teamName && row.teamName !== row.name && <small className="leaderboard-player">{row.name}</small>}{row.badges[0] && <small className="badge">{row.badges[0]}</small>}</span><span className="score"><strong>{row.points}</strong><small>Season total</small><small>{row.popupPoints} popup pts</small></span></div>)}<a className="text-link pick-score-link" href="/season#season-standings">See how points were earned →</a></div>
      <div className="panel"><p className="eyebrow">Your Outlast journey</p><h2>Every point, explained.</h2><p className="pick-help">See your picks, episode scores, and running season total.</p><a className="text-link" href="/season">Open My Season →</a></div>
      {data.locked && data.pickPercentages && <div className="panel pulse"><p className="eyebrow">League pulse</p><h2>What everyone picked</h2>{[["Weekly Favorite", "favorite_id"], ["Immunity", "immunity_pick"], ["Vote-Out", "boot_pick"]].map(([label, key]) => <div key={key}><h3>{label}</h3>{data.pickPercentages![key].slice(0, 4).map(percent => <div className="percent-row" key={percent.value}><span>{name(percent.value)}</span><strong>{percent.percent}%</strong></div>)}</div>)}</div>}
    </aside></div>
  </>;
}

function formatPickTime(value: string) {
  return new Date(value).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Detroit" });
}

function SeasonPickPanel({data,openingPick,setOpeningPick,endgamePick,setEndgamePick,saveEndgame,saving,dirty,message,error,locked,openingLocked,openingWindowClosed}:{data:LeagueData;openingPick:string;setOpeningPick:(value:string)=>void;endgamePick:string;setEndgamePick:(value:string)=>void;saveEndgame:()=>Promise<void>;saving:boolean;dirty:boolean;message:string;error:boolean;locked:boolean;openingLocked:boolean;openingWindowClosed:boolean}){
 const season=data.seasonPick;
 if(season.stage==="opening")return <section className="panel season-picks" id="opening-outlast-pick" tabIndex={-1}><div><p className="eyebrow">{season.openingGrace?"One-time opening pick · 10 points":"Required opening pick · 10 points"}</p><h2>Outlast Pick: Reach the Individual Game</h2>{season.openingGrace?<><p>You can choose your missing opening pick once. It becomes final when you tap Save picks and cannot be changed afterward. You can still save your weekly picks without making this choice.</p>{season.openingClosesAt&&<p className="repick-deadline">This one-time option closes {formatPickTime(season.openingClosesAt)} ET.</p>}{openingWindowClosed&&<p className="pick-warning">The opening-pick window is closed.</p>}</>:<p>Choose one castaway before Episode 1 locks.</p>}<p>You earn 10 points if your pick is still in the game when Jeff announces there are no more tribes and the game is individual—even if that castaway is voted out later in the same episode.</p></div><div><CastSelect id="opening-outlast" label="Opening Outlast Pick" value={openingPick} setValue={setOpeningPick} cast={data.castaways} disabled={data.preseasonLocked||openingLocked}/><PickReceipt label="Opening Outlast Pick" value={openingPick?data.castaways.find(c=>c.id===openingPick)?.name||openingPick:"No pick yet"}/></div></section>;
 if(season.stage==="waiting")return <section className="panel season-picks season-pick-status"><div><p className="eyebrow">Opening pick locked</p><h2>Outlast Pick: Reach the Individual Game</h2><p>Your pick stays in place until Jeff officially announces there are no more tribes and the game is individual. The one-time Final Torch decision opens after that episode’s spoiler-safe results reveal.</p></div><PickReceipt label="Locked Outlast Pick" value={season.originalName||"No opening pick was submitted"}/></section>;
 if(season.stage==="repick"){const active=data.castaways.some(c=>c.id===endgamePick),selectedName=data.castaways.find(c=>c.id===endgamePick)?.name||season.endgameName||endgamePick||"No pick yet";return <section className="panel season-picks season-pick-repick"><div><p className="eyebrow">One-time decision · Final Torch Pick</p><h2>Keep your pick or switch?</h2><p>Your opening pick: <strong>{season.originalName||"No pick submitted"}</strong> · <strong>{season.individualGamePoints} of 10 points earned</strong>.</p><p>Keep your original active castaway for the full endgame award: 10 points to win or 3 points to reach the finale. Switch to any remaining castaway for half: 5 points to win or 1.5 points to reach the finale. Your earned individual-game points do not change.</p>{season.repickClosesAt&&<p className="repick-deadline">Decision locks {new Date(season.repickClosesAt).toLocaleString("en-US",{weekday:"long",month:"long",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:"America/Detroit"})} ET.</p>}</div><div>{endgamePick&&!active&&<OptionHiddenWarning name={selectedName}/>}<CastSelect id="final-torch" label="Final Torch Pick" value={active?endgamePick:""} setValue={setEndgamePick} cast={data.castaways} disabled={locked}/><PickReceipt label="Final Torch Pick" value={selectedName}/><p className="pick-value-note">{!endgamePick?"Choose a remaining castaway · half points":endgamePick===season.originalId&&active?"Keeping original · full points":"Switching castaways · half points"}</p>{(message||dirty)&&<p className={error?"pick-save-error":"save-success"} role="status">{dirty&&!error?"Unsaved Final Torch change. Use the button below to save it.":message}</p>}<button type="button" className="button button-primary endgame-save" onClick={saveEndgame} disabled={saving||locked||!endgamePick||!active||!dirty}>{saving?"Saving…":locked?"Final Torch decision locked":dirty?"Save Final Torch Pick":"Final Torch Pick saved"}</button></div></section>}
 return <section className="panel season-picks season-pick-status"><div><p className="eyebrow">Final Torch decision locked</p><h2>Your Endgame Pick</h2><p>{season.switched?"You switched castaways, so this pick earns 5 points to win or 1.5 points to reach the finale.":"You kept your original castaway, so this pick earns 10 points to win or 3 points to reach the finale."}</p></div><div><PickReceipt label="Opening Outlast Pick" value={season.originalName||"No opening pick"}/><PickReceipt label="Final Torch Pick" value={season.endgameName||"No Final Torch pick"}/></div></section>;
}

function OptionHiddenWarning({name}:{name:string}){return <p className="pick-warning">{name} is no longer in the game. Choose a remaining castaway for your Final Torch Pick.</p>}
function PickReceipt({label,value}:{label:string;value:string}){return <p className="pick-receipt"><span>{label}</span><strong>{value}</strong></p>}
function CastSelect({id,label,value,setValue,cast,disabled}:{id:string;label:string;value:string;setValue:(value:string)=>void;cast:Castaway[];disabled:boolean}){return <select className="cast-select" id={id} aria-label={label} value={value} onChange={event=>setValue(event.target.value)} disabled={disabled}><option value="">Choose a castaway…</option>{cast.map(c=><option value={c.id} key={c.id}>{c.name} · {c.tribe==="Unassigned"?"Tribe TBA":c.tribe}</option>)}</select>}
function JoinForm({onJoined}:{onJoined:()=>Promise<void>}){const[name,setName]=useState(""),[team,setTeam]=useState(""),[inviteCode,setInviteCode]=useState(""),[busy,setBusy]=useState(false),[joinError,setJoinError]=useState("");async function join(event:React.FormEvent){
 event.preventDefault();setBusy(true);setJoinError("");
 try {
  const response=await fetch("/api/league",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({displayName:name,teamName:team,inviteCode})});
  const body=await response.json().catch(()=>null) as {ok?:boolean;error?:string}|null;
  if(!response.ok||!body?.ok){setJoinError(body?.error||"The league could not be joined. Try again.");return}
  await onJoined();
 } catch {setJoinError("Couldn’t connect. Your details are still here; try again.")}
 finally {setBusy(false)}
}return <form className="join-card" onSubmit={join}><p className="eyebrow">One last step</p><h2>Join the tribe</h2><p>Use the account you just created and the league code Mike shared. Your picks stay private until the episode locks. Joining also signs you up for one spoiler-free pick reminder before each new episode.</p>{joinError&&<div className="notice">{joinError}</div>}<label htmlFor="name">Your name</label><input id="name" required maxLength={40} value={name} onChange={event=>setName(event.target.value)} placeholder="Mike"/><label htmlFor="team">Team name <small>(optional · must be unique)</small></label><input id="team" maxLength={50} value={team} onChange={event=>setTeam(event.target.value)} placeholder="The Torch Snuffers"/><label htmlFor="invite-code">League code</label><input id="invite-code" required maxLength={40} autoCapitalize="characters" value={inviteCode} onChange={event=>setInviteCode(event.target.value)} placeholder="Enter league code"/><button className="button button-primary" disabled={busy}>{busy?"Joining…":"Join the tribe →"}</button></form>}
