"use client";

import { useMemo, useState } from "react";
import ApplicationCard from "./ApplicationCard";
import StatTiles from "./StatTiles";
import ThemeToggle from "./ThemeToggle";
import WeeklyChart from "./WeeklyChart";
import {
  agoWords,
  computeStats,
  isQuiet,
  sortByAppliedDesc,
  weeklyCounts,
} from "@/lib/derive";
import { statusMeta, type Application } from "@/lib/types";

type Filter = "all" | "waiting" | "replies" | "quiet";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "waiting", label: "Waiting" },
  { id: "replies", label: "Replies" },
  { id: "quiet", label: "Gone quiet" },
];

export default function Dashboard({
  apps,
  eyebrow = "Job search",
  headline,
  onEdit,
  children,
}: {
  apps: Application[];
  eyebrow?: string;
  headline?: string | null;
  /** Passed only where the viewer owns the log; its absence makes this read-only. */
  onEdit?: (app: Application) => void;
  children?: React.ReactNode;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const stats = useMemo(() => computeStats(apps), [apps]);
  const weeks = useMemo(() => weeklyCounts(apps), [apps]);

  const visible = useMemo(() => {
    const ordered = sortByAppliedDesc(apps);
    if (filter === "all") return ordered;
    if (filter === "waiting") return ordered.filter((a) => a.status === "applied");
    if (filter === "replies")
      return ordered.filter((a) => statusMeta(a.status).replied);
    return ordered.filter((a) => isQuiet(a));
  }, [apps, filter]);

  return (
    <main className="page">
      <div className="topbar">
        <div className="eyebrow">
          <span>{eyebrow}</span>
          <span className="live">live</span>
        </div>
        <ThemeToggle />
      </div>

      <header className="masthead">
        <div className="hero">
          <div className="hero-num">{stats.total}</div>
          <div className="hero-cap">
            application{stats.total === 1 ? "" : "s"}
            <br />
            sent into the void
          </div>
        </div>
        <div className="hero-rule" />
        {headline ? (
          <p className="hero-sub">{headline}</p>
        ) : (
          <p className="hero-sub">
            {stats.total === 0 ? (
              "Nothing logged yet. The tally starts with the next one."
            ) : (
              <>
                Most recent: <b>{agoWords(stats.mostRecent)}</b>.{" "}
                {stats.replies === 0 ? (
                  <>
                    Replies so far: <b>zero</b>.
                  </>
                ) : (
                  <>
                    <b>{stats.replies}</b> wrote back.
                  </>
                )}
                {stats.quiet > 0 && (
                  <>
                    {" "}
                    <b>{stats.quiet}</b> never did.
                  </>
                )}
              </>
            )}
          </p>
        )}
      </header>

      <StatTiles stats={stats} />
      <WeeklyChart weeks={weeks} />

      <section>
        <div className="panel-head" style={{ padding: "0 2px" }}>
          <h2 className="panel-title">The log</h2>
          <span className="panel-note">{visible.length} shown</span>
        </div>

        <div className="filters" style={{ marginBottom: 12 }}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className="chip"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {visible.length > 0 ? (
          <ul className="cards">
            {visible.map((app) => (
              <ApplicationCard key={app.id} app={app} onEdit={onEdit} />
            ))}
          </ul>
        ) : (
          <div className="empty">
            <h3>
              {apps.length
                ? "Nothing in this filter"
                : "No applications logged yet"}
            </h3>
            <p>
              {apps.length
                ? "Try “Everything”."
                : "The first one shows up here — role, pay, location, and exactly how long it has been quiet."}
            </p>
          </div>
        )}
      </section>

      {children}
    </main>
  );
}
