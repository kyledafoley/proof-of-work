import { agoWords, daysSince, shortDate } from "@/lib/derive";
import { statusMeta, type Application } from "@/lib/types";

export default function ApplicationCard({
  app,
  onEdit,
}: {
  app: Application;
  onEdit?: (app: Application) => void;
}) {
  const meta = statusMeta(app.status);
  const days = daysSince(app.applied_on);
  const showSilence =
    (app.status === "applied" || app.status === "ghosted") &&
    days !== null &&
    days >= 7;

  return (
    <li className="card">
      <div className="card-top">
        <div>
          <h3 className="role">{app.role}</h3>
          {app.company && <div className="company">{app.company}</div>}
        </div>
        <span className={`pill pill-${meta.id}`}>
          <span className="dot" aria-hidden="true" />
          {meta.label}
        </span>
      </div>

      {app.description && <p className="desc">{app.description}</p>}

      <dl className="meta">
        {app.location && (
          <div>
            <dt>Location</dt>
            <dd>{app.location}</dd>
          </div>
        )}
        {app.salary && (
          <div>
            <dt>Salary</dt>
            <dd>{app.salary}</dd>
          </div>
        )}
        <div>
          <dt>Applied</dt>
          <dd>
            {shortDate(app.applied_on)} · {agoWords(days)}
          </dd>
        </div>
      </dl>

      {showSilence && (
        <div className="silence">
          {days} days of silence{days! >= 30 ? " — and counting" : ""}
        </div>
      )}

      {onEdit && (
        <button
          type="button"
          className="btn btn-ghost btn-small self-start"
          onClick={() => onEdit(app)}
        >
          Edit
        </button>
      )}
    </li>
  );
}
