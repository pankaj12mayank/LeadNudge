import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import Card from "../../components/Card";
import Table from "../../components/Table";
import Badge from "../../components/Badge";
import PaginationBar from "../../components/PaginationBar";
import * as userService from "../../services/userService";
import {
  followupPriority,
  priorityLabel,
} from "../../utils/followupPriority";
import { formatScheduleDisplay } from "../../utils/formatSchedule";

export default function Followups() {
  const [page, setPage] = useState(1);
  const limit = 20;
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [leads, setLeads] = useState([]);
  const [leadId, setLeadId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [leadSearch, setLeadSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [rescheduleRow, setRescheduleRow] = useState(null);
  const [rescheduleAt, setRescheduleAt] = useState("");

  const filteredLeads = useMemo(() => {
    const q = leadSearch.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      (l) =>
        (l.name || "").toLowerCase().includes(q) ||
        (l.email || "").toLowerCase().includes(q),
    );
  }, [leads, leadSearch]);

  const selectedLead = useMemo(
    () => leads.find((l) => String(l.id) === leadId),
    [leads, leadId],
  );

  const schedulePreview =
    scheduledAt && !Number.isNaN(new Date(scheduledAt).getTime())
      ? new Date(scheduledAt).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "—";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const l = await userService.listLeads(undefined, { page: 1, limit: 500 });
        if (cancelled) return;
        const leadItems = l.items ?? [];
        setLeads(leadItems);
        setLeadId((prev) =>
          prev || (leadItems[0] ? String(leadItems[0].id) : ""),
        );
      } catch (e) {
        if (!cancelled) toast.error(e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!filteredLeads.length) {
      setLeadId("");
      return;
    }
    setLeadId((prev) =>
      prev && filteredLeads.some((l) => String(l.id) === prev)
        ? prev
        : String(filteredLeads[0].id),
    );
  }, [filteredLeads]);

  const loadFollowups = useCallback(async () => {
    setListLoading(true);
    try {
      const f = await userService.listFollowups(undefined, { page, limit });
      setRows(f.items ?? []);
      setTotal(f.total ?? 0);
      setPages(f.pages ?? 1);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setListLoading(false);
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    loadFollowups();
  }, [loadFollowups]);

  useEffect(() => {
    const id = setInterval(() => {
      loadFollowups();
    }, 20000);
    return () => clearInterval(id);
  }, [loadFollowups]);

  async function onSchedule(e) {
    e.preventDefault();
    if (!leadId || !scheduledAt) {
      toast.warning("Lead and schedule time required");
      return;
    }
    // datetime-local is local wall time; toISOString() converts to UTC for the API.
    const picked = new Date(scheduledAt);
    if (Number.isNaN(picked.getTime())) {
      toast.warning("Pick a valid date and time");
      return;
    }
    const iso = picked.toISOString();
    setSaving(true);
    try {
      await userService.createFollowup({
        lead_id: Number(leadId),
        scheduled_at: iso,
      });
      toast.success(
        "Follow-up queued. The AI draft is created at the scheduled time from your lead note and thread.",
      );
      await loadFollowups();
      try {
        const l = await userService.listLeads(undefined, { page: 1, limit: 500 });
        setLeads(l.items ?? []);
      } catch {
        /* ignore */
      }
    } catch {
      toast.error(
        "Temporary issue scheduling your follow-up. Please try again in a moment.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function copyDraft(text) {
    const t = (text || "").trim();
    if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
      toast.success("Draft copied to clipboard");
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = t;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        toast.success("Draft copied to clipboard");
      } catch {
        toast.error("Could not copy automatically — select the text in the box.");
      }
    }
  }

  function toDatetimeLocalValue(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const t = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return t.toISOString().slice(0, 16);
  }

  function openReschedule(row) {
    setRescheduleRow(row);
    setRescheduleAt(toDatetimeLocalValue(row.scheduled_at));
  }

  async function onCancelFollowup(row) {
    if (!confirm("Cancel this scheduled follow-up?")) return;
    try {
      await userService.patchFollowup(row.id, { cancel: true });
      toast.success("Follow-up cancelled.");
      await loadFollowups();
    } catch (e) {
      toast.error(e.message || "Could not cancel.");
    }
  }

  async function submitReschedule(e) {
    e.preventDefault();
    if (!rescheduleRow || !rescheduleAt) return;
    const picked = new Date(rescheduleAt);
    if (Number.isNaN(picked.getTime())) {
      toast.warning("Pick a valid date and time");
      return;
    }
    try {
      await userService.patchFollowup(rescheduleRow.id, {
        scheduled_at: picked.toISOString(),
      });
      toast.success("Follow-up rescheduled.");
      setRescheduleRow(null);
      await loadFollowups();
    } catch (e) {
      toast.error(e.message || "Could not reschedule.");
    }
  }

  async function onDeleteFollowup(row) {
    if (
      !confirm(
        "Delete this follow-up? You can schedule a new one later. This cannot be undone.",
      )
    ) {
      return;
    }
    try {
      await userService.deleteFollowup(row.id);
      toast.success("Follow-up removed.");
      await loadFollowups();
    } catch (e) {
      toast.error(e.message || "Could not delete this follow-up.");
    }
  }

  const columns = [
    { key: "id", label: "ID" },
    {
      key: "lead_id",
      label: "Lead",
      render: (r) => (
        <span className="text-sm">
          {r.lead_name ? (
            <>
              <span className="text-neutral-900 dark:text-neutral-100">{r.lead_name}</span>{" "}
            </>
          ) : null}
          <span className="text-neutral-500 dark:text-neutral-400">#{r.lead_id}</span>
        </span>
      ),
    },
    {
      key: "scheduled_at",
      label: "Scheduled",
      render: (r) => formatScheduleDisplay(r.scheduled_at),
    },
    {
      key: "priority",
      label: "Priority",
      render: (r) => {
        const p = followupPriority(r.scheduled_at);
        const v =
          p === "high" ? "solid" : p === "medium" ? "outline" : "muted";
        return <Badge variant={v}>{priorityLabel(p)}</Badge>;
      },
    },
    {
      key: "status",
      label: "Status",
      render: (r) => {
        const failed = r.status === "ai_failed";
        const label =
          r.status === "pending"
            ? "Scheduled"
            : r.status === "sent"
              ? "Sent"
              : r.status === "draft_ready"
                ? "Draft ready"
                : r.status === "cancelled"
                  ? "Cancelled"
                  : failed
                    ? "Failed"
                    : r.status;
        const solid = r.status === "draft_ready" || r.status === "sent";
        return (
          <Badge
            variant={
              solid ? "solid" : failed ? "outline" : "muted"
            }
          >
            {label}
          </Badge>
        );
      },
    },
    {
      key: "sent_at",
      label: "Sent (SMTP)",
      render: (r) =>
        r.status === "sent" && r.sent_at
          ? formatScheduleDisplay(r.sent_at)
          : "—",
    },
    {
      key: "last_message",
      label: "AI draft",
      render: (r) => {
        const text = r.last_message;
        if (!text) {
          return <span className="text-neutral-500 dark:text-neutral-400">—</span>;
        }
        return (
          <div className="max-w-lg space-y-2">
            <div className="max-h-56 min-h-[5rem] overflow-y-auto rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap text-neutral-900 dark:border-neutral-600 dark:bg-neutral-900/70 dark:text-neutral-100">
              {text}
            </div>
            <button
              type="button"
              className="text-xs font-medium text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              onClick={() => copyDraft(text)}
            >
              Copy draft
            </button>
          </div>
        );
      },
    },
    {
      key: "failure_reason",
      label: "If AI failed",
      render: (r) => (
        <span className="max-w-xs text-xs text-red-700 dark:text-red-400">
          {r.failure_reason || "—"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (r) => {
        const canDel =
          r.status === "pending" ||
          r.status === "ai_failed" ||
          r.status === "draft_ready" ||
          r.status === "cancelled";
        const pending = r.status === "pending";
        return (
          <div className="flex flex-col gap-1.5">
            {pending ? (
              <>
                <button
                  type="button"
                  className="text-left text-xs font-medium text-neutral-700 underline decoration-neutral-400 underline-offset-2 dark:text-neutral-300"
                  onClick={() => onCancelFollowup(r)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="text-left text-xs font-medium text-blue-700 underline decoration-blue-300 underline-offset-2 dark:text-blue-400"
                  onClick={() => openReschedule(r)}
                >
                  Reschedule
                </button>
              </>
            ) : null}
            {canDel ? (
              <button
                type="button"
                className="text-left text-xs font-medium text-red-700 underline decoration-red-300 underline-offset-2 dark:text-red-400"
                onClick={() => onDeleteFollowup(r)}
              >
                Delete
              </button>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <div className="w-full space-y-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="w-full border-b border-neutral-200 pb-6 dark:border-neutral-800">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Outreach
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Scheduled follow-ups &amp; drafts
        </h1>
        <p className="mt-2 w-full text-sm text-neutral-600 dark:text-neutral-400">
          Pick a lead and a future time. When that time passes, the server builds a human-style draft
          from the latest thread (or the lead&apos;s &quot;last message&quot; field) — so what you save
          on the lead drives the AI. You get a short in-app heads-up when a follow-up is about five
          minutes away. With SMTP set up, email goes to the lead&apos;s address and each send is listed
          under Sent mail.
        </p>
      </section>

      <Card title="Schedule follow-up">
        <form onSubmit={onSchedule} className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <label className="form-label" htmlFor="lead-search">
                Find lead
              </label>
              <input
                id="lead-search"
                type="search"
                className="form-input w-full"
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
                placeholder="Search by name or email"
                disabled={saving}
                autoComplete="off"
              />
              <label className="form-label" htmlFor="lead-select">
                Lead
              </label>
              <select
                id="lead-select"
                className="form-select w-full min-w-0"
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
                disabled={saving || !filteredLeads.length}
              >
                {filteredLeads.length === 0 ? (
                  <option value="">No matches</option>
                ) : null}
                {filteredLeads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} · {l.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-3">
              <label className="form-label" htmlFor="fu-datetime">
                Date &amp; time
              </label>
              <input
                id="fu-datetime"
                type="datetime-local"
                className="form-input w-full"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                disabled={saving}
              />
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Uses your device timezone. The API stores UTC; the table below shows local time.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900/40">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Summary
            </p>
            <dl className="mt-2 space-y-1 text-sm text-neutral-800 dark:text-neutral-200">
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-neutral-500 dark:text-neutral-400">Lead</dt>
                <dd>
                  {selectedLead ? (
                    <>
                      <span className="font-medium">{selectedLead.name}</span>
                      <span className="text-neutral-600 dark:text-neutral-400">
                        {" "}
                        ({selectedLead.email})
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-neutral-500 dark:text-neutral-400">Scheduled</dt>
                <dd className="font-medium">{schedulePreview}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
              Status <strong className="font-medium text-neutral-700 dark:text-neutral-300">Scheduled</strong>{" "}
              until the due time, then <strong className="font-medium">Sent</strong> (SMTP) or{" "}
              <strong className="font-medium">Draft ready</strong> to copy. Use{" "}
              <strong className="font-medium">Cancel</strong> or <strong className="font-medium">Reschedule</strong>{" "}
              on pending rows. If you see a generation error, delete and try again.
            </p>
          </div>

          <button
            type="submit"
            disabled={
              saving ||
              !leads.length ||
              !leadId ||
              !scheduledAt ||
              Number.isNaN(new Date(scheduledAt).getTime())
            }
            className="btn-primary"
          >
            {saving ? "Scheduling…" : "Schedule follow-up"}
          </button>
        </form>
      </Card>

      <Card title="Scheduled follow-ups">
        {loading ? (
          <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
        ) : (
          <>
            <p className="mb-4 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-300">
              <span className="font-medium text-neutral-900 dark:text-neutral-100">sent</span> means
              SMTP delivery succeeded (see the Sent column for time).{" "}
              <span className="font-medium text-neutral-900 dark:text-neutral-100">draft_ready</span>{" "}
              means you should use <span className="font-medium">Copy draft</span> and send from
              your own inbox. You can delete scheduled, failed, or unsent drafts only — not sent rows.
            </p>
            <Table columns={columns} rows={rows} emptyText="No follow-ups yet" />
            <PaginationBar
              page={page}
              pages={pages}
              total={total}
              limit={limit}
              disabled={listLoading}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      {rescheduleRow ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close"
            onClick={() => setRescheduleRow(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Reschedule follow-up #{rescheduleRow.id}
            </h2>
            <form onSubmit={submitReschedule} className="mt-4 space-y-4">
              <div>
                <label className="form-label">New date &amp; time</label>
                <input
                  type="datetime-local"
                  className="form-input w-full"
                  value={rescheduleAt}
                  onChange={(e) => setRescheduleAt(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn-primary">
                  Save
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setRescheduleRow(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
