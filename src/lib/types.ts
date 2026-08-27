export type Status = "applied" | "heard" | "interview" | "rejected" | "ghosted";

export type Application = {
  id: string;
  role: string;
  company: string | null;
  description: string | null;
  location: string | null;
  salary: string | null;
  applied_on: string; // YYYY-MM-DD
  status: Status;
};

export type StatusMeta = {
  id: Status;
  label: string;
  /** Still in play — no final answer yet. */
  open: boolean;
  /** They responded, whatever the answer was. */
  replied: boolean;
};

export const STATUSES: StatusMeta[] = [
  { id: "applied", label: "Applied", open: true, replied: false },
  { id: "heard", label: "Heard back", open: true, replied: true },
  { id: "interview", label: "Interview", open: true, replied: true },
  { id: "rejected", label: "Rejected", open: false, replied: true },
  { id: "ghosted", label: "Ghosted", open: false, replied: false },
];

export function statusMeta(status: Status): StatusMeta {
  return STATUSES.find((s) => s.id === status) ?? STATUSES[0];
}

/** Days of silence after which an untouched application counts as gone quiet. */
export const QUIET_AFTER_DAYS = 21;
