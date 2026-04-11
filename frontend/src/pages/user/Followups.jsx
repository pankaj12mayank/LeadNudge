import { useEffect, useState } from "react";
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [listLoading, setListLoading] = useState(false);

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

  async function loadFollowups() {
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
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setListLoading(true);
      try {
        const f = await userService.listFollowups(undefined, { page, limit });
        if (!cancelled) {
          setRows(f.items ?? []);
          setTotal(f.total ?? 0);
          setPages(f.pages ?? 1);
        }
      } catch (e) {
        if (!cancelled) toast.error(e.message);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setListLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, limit]);

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
      toast.success("Follow-up scheduled; draft generated when possible");
      await loadFollowups();
      try {
        const l = await userService.listLeads(undefined, { page: 1, limit: 500 });
        setLeads(l.items ?? []);
      } catch {
        /* ignore */
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    { key: "id", label: "ID" },
    { key: "lead_id", label: "Lead" },
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
      render: (r) => (
        <Badge
          variant={
            r.status === "draft_ready"
              ? "solid"
              : r.status === "ai_failed"
                ? "outline"
                : "muted"
          }
        >
          {r.status}
        </Badge>
      ),
    },
    {
      key: "last_message",
      label: "AI message",
      render: (r) => (
        <span className="line-clamp-2 max-w-md text-neutral-600 dark:text-neutral-400">
          {r.last_message || "—"}
        </span>
      ),
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
          Pick a lead, set a time, and review AI-generated draft copy. Priority follows how soon
          each item is due.
        </p>
      </section>

      <Card title="Schedule follow-up">
        <form
          onSubmit={onSchedule}
          className="flex flex-wrap items-end gap-4"
        >
          <div>
            <label className="form-label">Lead</label>
            <select
              className="form-select min-w-[200px]"
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              disabled={saving}
            >
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.email})
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0 flex-1 sm:max-w-md">
            <label className="form-label">Date &amp; time (your timezone)</label>
            <input
              type="datetime-local"
              className="form-input w-full"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              disabled={saving}
            />
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Shown below in your local format after you save.
            </p>
          </div>
          <button
            type="submit"
            disabled={saving || !leads.length}
            className="btn-primary"
          >
            Schedule
          </button>
        </form>
      </Card>

      <Card title="Scheduled follow-ups">
        {loading ? (
          <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
        ) : (
          <>
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
    </div>
  );
}
