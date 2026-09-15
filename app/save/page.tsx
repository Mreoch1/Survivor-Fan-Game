import type { Metadata } from "next";
import { AppShell } from "../components/AppShell";

export const metadata: Metadata = { title: "Save to my phone" };

export default function SavePage() {
  return <AppShell><main className="wrap interior-page help-page">
    <header className="page-hero"><p className="eyebrow">One tap back to camp</p><h1>Save Outlast to your phone.</h1><p>Put an Outlast 51 icon beside your other apps. No more searching old texts for the link.</p></header>
    <div className="save-intro"><span className="save-app-icon" aria-hidden="true">51</span><div><h2>Start in your phone&apos;s web browser</h2><p>If this page opened inside an email or text app, use its menu to open in <strong>Safari on iPhone</strong> or <strong>Chrome on Android</strong>. Stay on this page and follow the steps for your phone below.</p></div></div>
    <div className="save-guides">
      <section className="save-guide"><p className="eyebrow">Apple phone</p><h2>iPhone</h2><ol><li>Open Outlast in <strong>Safari</strong>.</li><li>Tap <strong>Share</strong>—the square with an arrow pointing up. You may need to open the page menu first.</li><li>Scroll down and tap <strong>Add to Home Screen</strong>.</li><li>Name it <strong>Outlast 51</strong>. Turn on <strong>Open as Web App</strong> if offered, then tap <strong>Add</strong>.</li></ol><p>Look for the Outlast 51 icon on your Home Screen. Tap it to open the league.</p><a href="https://support.apple.com/en-euro/guide/iphone/iphea86e5236/ios" target="_blank" rel="noreferrer">Apple&apos;s instructions ↗</a></section>
      <section className="save-guide"><p className="eyebrow">Samsung, Pixel, and other phones</p><h2>Android</h2><ol><li>Open Outlast in <strong>Chrome</strong>.</li><li>Tap the <strong>three dots</strong> beside the address bar.</li><li>Tap <strong>Install and create shortcut</strong>, then <strong>Create shortcut</strong>. Your phone may say <strong>Add to Home screen</strong> or <strong>Install app</strong> instead.</li><li>Name it <strong>Outlast 51</strong> and tap <strong>Add</strong> or <strong>Install</strong> to confirm.</li></ol><p>You&apos;ll find a new Outlast 51 icon on your phone. Tap it whenever you want to play.</p><a href="https://support.google.com/chrome/answer/15085120?co=GENIE.Platform%3DAndroid&hl=en" target="_blank" rel="noreferrer">Google&apos;s instructions ↗</a></section>
      <section className="save-guide"><p className="eyebrow">Laptop or desktop</p><h2>Computer</h2><ol><li>Open Outlast in your usual browser.</li><li>Press <strong>Ctrl + D</strong> on Windows or <strong>Command + D</strong> on a Mac.</li><li>Name the bookmark <strong>Outlast 51</strong>. Save it to your bookmarks bar or Favorites.</li></ol><p>Use that bookmark to come back next time.</p></section>
    </div>
    <section className="save-guide save-finish"><h2>Sign in once on your own phone</h2><p>After opening your new icon, sign in if asked and choose <strong>Keep me signed in</strong>. Use your existing account so you can return to any picks you&apos;ve already saved.</p><p>Not joined yet? <a href="/signup">Create an account</a>, confirm your email if prompted, then join the league using the code Mike shared.</p><a className="button button-primary" href="/login?returnTo=%2Fplay">Sign in and make my picks</a></section>
  </main></AppShell>;
}
