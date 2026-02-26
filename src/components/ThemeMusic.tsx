"use client";

import { useState, useRef, useEffect } from "react";

/**
 * Royalty-free tribal/adventure theme. Uses Pixabay track when available.
 * Replace audio src with your chosen royalty-free track (e.g. from Pixabay Music).
 */
const THEME_MUSIC_SRC =
  process.env.NEXT_PUBLIC_THEME_MUSIC_URL ||
  "https://cdn.pixabay.com/audio/2022/03/10/audio_3a2d2e2c2b.mp3";

export function ThemeMusic() {
  const [playing, setPlaying] = useState(false);
  const [mounted, setMounted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  function toggle() {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
    setPlaying(!playing);
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnd = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    return () => {
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, [mounted]);

  if (!mounted) return null;

  return (
    <>
      <audio ref={audioRef} src={THEME_MUSIC_SRC} loop />
      <button
        type="button"
        onClick={toggle}
        className={`survivor-music-toggle ${playing ? "survivor-music-toggle--playing" : ""}`}
        aria-label={playing ? "Pause theme music" : "Play theme music"}
        title={playing ? "Pause theme music" : "Play theme music"}
      >
        <span aria-hidden>{playing ? "⏸" : "♪"}</span>
      </button>
    </>
  );
}
