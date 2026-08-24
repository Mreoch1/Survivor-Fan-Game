"use client";
import { useState } from "react";
import { createClient } from "../../lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[name,setName]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  const router=useRouter();
  async function submit(event:React.FormEvent){event.preventDefault();setBusy(true);setMessage("");const supabase=createClient();const {data,error}=await supabase.auth.signUp({email,password,options:{data:{display_name:name},emailRedirectTo:`${window.location.origin}/auth/callback?next=/play`}});setBusy(false);if(error){setMessage(error.message);return}if(data.session){router.push("/play");router.refresh();return}setMessage("Account created. Check your email if confirmation is requested, then sign in.")}
  return <main className="auth-page"><form className="join-card auth-card" onSubmit={submit}><Link className="brand" href="/"><span className="brand-mark">51</span><span>OUTLAST<br/><small>FANTASY LEAGUE</small></span></Link><p className="eyebrow">First-time player</p><h1>Join the tribe.</h1><label htmlFor="name">Your name</label><input id="name" required maxLength={40} value={name} onChange={e=>setName(e.target.value)}/><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/><label htmlFor="password">Password <small>(at least 6 characters)</small></label><input id="password" type="password" minLength={6} autoComplete="new-password" required value={password} onChange={e=>setPassword(e.target.value)}/>{message&&<div className="notice">{message}</div>}<button className="button button-primary" disabled={busy}>{busy?"Creating account…":"Create account →"}</button><p>Already registered? <Link href="/login">Sign in</Link></p></form></main>;
}
