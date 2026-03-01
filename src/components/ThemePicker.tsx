"use client";

import { useEffect, useState } from "react";
import type { TribeId } from "@/data/players";
import { TRIBES } from "@/data/players";

const THEME_KEY = "survivor-theme";

export function ThemePicker() {
  const [theme, setTheme] = useState<TribeId | "">("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY) as TribeId | null;
    if (stored && (stored === "cila" || stored === "kalo" || stored === "vatu")) {
      setTheme(stored);
      document.documentElement.setAttribute("data-theme", stored);
    } else {
      setTheme("");
      document.documentElement.removeAttribute("data-theme");
    }
    setMounted(true);
  }, []);

  function handleChange(newTheme: TribeId | "") {
    setTheme(newTheme);
    if (newTheme) {
      document.documentElement.setAttribute("data-theme", newTheme);
      localStorage.setItem(THEME_KEY, newTheme);
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.removeItem(THEME_KEY);
    }
  }

  if (!mounted) {
    return (
      <div className="survivor-theme-picker" aria-hidden>
        <span className="survivor-theme-picker__label">Theme</span>
        <div className="survivor-theme-picker__options" />
      </div>
    );
  }

  return (
    <div className="survivor-theme-picker">
      <span className="survivor-theme-picker__label" id="theme-picker-label">
        Theme
      </span>
      <div
        className="survivor-theme-picker__options"
        role="group"
        aria-labelledby="theme-picker-label"
      >
        <button
          type="button"
          className="survivor-theme-picker__btn"
          onClick={() => handleChange("")}
          title="Default (gold)"
          aria-pressed={theme === "" ? "true" : "false"}
        >
          <span className="survivor-theme-picker__swatch survivor-theme-picker__swatch--default" />
        </button>
        {(Object.keys(TRIBES) as TribeId[]).map((id) => (
          <button
            key={id}
            type="button"
            className="survivor-theme-picker__btn"
            onClick={() => handleChange(id)}
            title={`${TRIBES[id].name} theme`}
            aria-pressed={theme === id ? "true" : "false"}
          >
            <span className={`survivor-theme-picker__swatch survivor-theme-picker__swatch--${id}`} />
          </button>
        ))}
      </div>
    </div>
  );
}
