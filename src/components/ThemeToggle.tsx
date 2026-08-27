"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("pow-theme");
    if (stored === "dark" || stored === "light") {
      setTheme(stored);
      return;
    }
    setTheme(
      window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light",
    );
  }, []);

  function flip() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("pow-theme", next);
    } catch {
      // Private browsing — the toggle still works for this page view.
    }
  }

  return (
    <button
      type="button"
      className="toggle"
      onClick={flip}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      title="Switch theme"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
        {theme === "dark" ? (
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="12" cy="12" r="4.2" />
            <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
          </g>
        ) : (
          <path
            fill="currentColor"
            d="M20.7 14.6a8.5 8.5 0 0 1-11.3-11 8.6 8.6 0 1 0 11.3 11Z"
          />
        )}
      </svg>
    </button>
  );
}
