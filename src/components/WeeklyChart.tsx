"use client";

import { useState } from "react";
import type { Week } from "@/lib/derive";

/**
 * Eight seven-day windows of application volume. One series, so no legend —
 * the panel title names it. Non-zero counts are labelled directly; a hover or
 * focus tooltip carries the week each bar covers.
 */
export default function WeeklyChart({ weeks }: { weeks: Week[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(1, ...weeks.map((w) => w.count));

  return (
    <section className="panel chart-panel">
      <div className="panel-head">
        <h2 className="panel-title">Applications per week</h2>
        <span className="panel-note">last 8 weeks</span>
      </div>

      <div className="chart-area">
        {hovered !== null && (
          <div
            className="tip"
            style={{ left: `${((hovered + 0.5) / weeks.length) * 100}%` }}
          >
            {weeks[hovered].count} · week of {weeks[hovered].label}
          </div>
        )}

        <div className="bars">
          {weeks.map((week, i) => (
            <button
              key={`${week.label}-${i}`}
              type="button"
              className="bar-col"
              onPointerEnter={() => setHovered(i)}
              onPointerLeave={() => setHovered(null)}
              onFocus={() => setHovered(i)}
              onBlur={() => setHovered(null)}
              aria-label={`${week.count} application${
                week.count === 1 ? "" : "s"
              } in the week of ${week.label}`}
            >
              {week.count > 0 && <span className="bar-val">{week.count}</span>}
              <span
                className={week.count ? "bar" : "bar bar-zero"}
                style={
                  week.count
                    ? { height: `${Math.max(6, (week.count / max) * 84)}%` }
                    : undefined
                }
              />
            </button>
          ))}
        </div>
      </div>

      <div className="bar-axis" aria-hidden="true">
        {weeks.map((week, i) => (
          <span key={`${week.label}-axis-${i}`}>
            {i % 2 === 0 || i === weeks.length - 1 ? week.label : ""}
          </span>
        ))}
      </div>
    </section>
  );
}
