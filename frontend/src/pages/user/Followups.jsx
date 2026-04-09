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
    const iso = new Date(scheduledAt).toISOString();
    setSaving(true);
    try {
      await userService.createFollowup({
        lead_id: Number(leadId),
        scheduled_at: iso,
      });
      toast.success("Follow-up scheduled; draft generated when possible");
      await loadFollowups();
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
      render: (r) => new Date(r.scheduled_at).toLocaleString(),
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
  ];

  return (
    <div className="space-y-8 p-4 lg:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Follow-ups
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Schedule follow-ups and review draft copy. Priority is derived from how
          soon the item is due.
        </p>
      </div>

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
          <div>
            <label className="form-label">Date & time</label>
            <input
              type="datetime-local"
              className="form-input"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              disabled={saving}
            />
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
