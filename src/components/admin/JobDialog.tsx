"use client";

import { useEffect, useRef, useState } from "react";
import { todayISO } from "@/lib/derive";
import { STATUSES, type Application, type Status } from "@/lib/types";

export type Draft = {
  role: string;
  company: string;
  description: string;
  location: string;
  salary: string;
  applied_on: string;
  status: Status;
};

function toDraft(app: Application | null): Draft {
  return {
    role: app?.role ?? "",
    company: app?.company ?? "",
    description: app?.description ?? "",
    location: app?.location ?? "",
    salary: app?.salary ?? "",
    applied_on: app?.applied_on ?? todayISO(),
    status: app?.status ?? "applied",
  };
}

export default function JobDialog({
  open,
  editing,
  onSave,
  onDelete,
  onClose,
}: {
  open: boolean;
  editing: Application | null;
  onSave: (draft: Draft) => Promise<string | null>;
  onDelete: (app: Application) => Promise<string | null>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<Draft>(() => toDraft(editing));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    setDraft(toDraft(editing));
    setError(null);
    setArmed(false);
  }, [editing, open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function save() {
    if (!draft.role.trim()) {
      setError("A job title is needed — everything else is optional.");
      return;
    }
    setBusy(true);
    setError(await onSave(draft));
    setBusy(false);
  }

  async function remove() {
    if (!editing) return;
    if (!armed) {
      setArmed(true);
      return;
    }
    setBusy(true);
    setError(await onDelete(editing));
    setBusy(false);
  }

  return (
    <dialog ref={ref} onCancel={onClose} onClose={onClose} className="dlg">
      <form method="dialog" onSubmit={(e) => e.preventDefault()}>
        <div className="dlg-head">
          <h2 className="panel-title" style={{ fontSize: 18 }}>
            {editing ? "Edit application" : "Log an application"}
          </h2>
        </div>

        <div className="dlg-body">
          <div className="field">
            <label htmlFor="f-role">Job title</label>
            <input
              id="f-role"
              value={draft.role}
              onChange={(e) => set("role", e.target.value)}
              placeholder="Senior React Native Engineer"
              autoFocus
            />
          </div>

          <div className="field">
            <label htmlFor="f-company">Company</label>
            <input
              id="f-company"
              value={draft.company}
              onChange={(e) => set("company", e.target.value)}
              placeholder="Acme Corp"
            />
          </div>

          <div className="field">
            <label htmlFor="f-desc">What the job is</label>
            <textarea
              id="f-desc"
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="A sentence or two — what they want, what it involves."
            />
          </div>

          <div className="row2">
            <div className="field">
              <label htmlFor="f-loc">Location</label>
              <input
                id="f-loc"
                value={draft.location}
                onChange={(e) => set("location", e.target.value)}
                placeholder="Charlotte, NC / Remote"
              />
            </div>
            <div className="field">
              <label htmlFor="f-sal">Salary</label>
              <input
                id="f-sal"
                value={draft.salary}
                onChange={(e) => set("salary", e.target.value)}
                placeholder="$110–130k"
              />
            </div>
          </div>

          <div className="row2">
            <div className="field">
              <label htmlFor="f-date">Date applied</label>
              <input
                id="f-date"
                type="date"
                value={draft.applied_on}
                onChange={(e) => set("applied_on", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="f-status">Status</label>
              <select
                id="f-status"
                value={draft.status}
                onChange={(e) => set("status", e.target.value as Status)}
              >
                {STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}
        </div>

        <div className="dlg-foot">
          {editing && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={remove}
              disabled={busy}
            >
              {armed ? "Tap again to delete" : "Delete"}
            </button>
          )}
          <span className="spacer" />
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button type="button" className="btn" onClick={save} disabled={busy}>
            {busy ? "Saving…" : editing ? "Save changes" : "Add it"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
