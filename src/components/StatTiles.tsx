import type { Stats } from "@/lib/derive";
import { QUIET_AFTER_DAYS } from "@/lib/types";

function Tile({
  value,
  label,
  note,
}: {
  value: number;
  label: string;
  note: string;
}) {
  return (
    <div className="tile">
      <div className="tile-v">{value}</div>
      <div className="tile-k">{label}</div>
      <div className="tile-note">{note}</div>
    </div>
  );
}

export default function StatTiles({ stats }: { stats: Stats }) {
  return (
    <section className="tiles">
      <Tile value={stats.thisWeek} label="Sent this week" note="last 7 days" />
      <Tile value={stats.waiting} label="Still waiting" note="no reply yet" />
      <Tile
        value={stats.replies}
        label="Replies back"
        note={
          stats.responseRate === null
            ? "nothing yet"
            : `${stats.responseRate}% response rate`
        }
      />
      <Tile
        value={stats.quiet}
        label="Gone quiet"
        note={`${QUIET_AFTER_DAYS}+ days of silence`}
      />
    </section>
  );
}
