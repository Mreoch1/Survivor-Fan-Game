"use client";
import { useEffect, useState } from "react";

function remaining(target: string) {
  const ms = Math.max(0, new Date(target).getTime() - Date.now());
  return { days: Math.floor(ms / 86400000), hours: Math.floor(ms / 3600000) % 24, mins: Math.floor(ms / 60000) % 60 };
}

export function Countdown({ target }: { target: string }) {
  const [time, setTime] = useState(() => remaining(target));
  useEffect(() => { const id = window.setInterval(() => setTime(remaining(target)), 30000); return () => clearInterval(id); }, [target]);
  return <div className="countdown" aria-live="polite">{Object.entries(time).map(([label, value]) => <div key={label}><strong>{String(value).padStart(2,"0")}</strong><span>{label}</span></div>)}</div>;
}
