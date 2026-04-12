import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import Card from "../../components/Card";
import Table from "../../components/Table";
import PaginationBar from "../../components/PaginationBar";
import * as adminService from "../../services/adminService";

function formatRow(r) {
  const when = new Date(r.created_at).toLocaleString();
  const who = r.user_email || (r.user_id != null ? `user #${r.user_id}` : "—");
  const lim =
    r.old_limit != null && r.new_limit != null
      ? `${r.old_limit}→${r.new_limit}`
      : "—";
  return { who, action: r.action_type, lim, when, summary: r.summary || "—" };
}

export default function UsageHistory() {
  const [page, setPage] = useState(1);
  const limit = 30;
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(() => new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminService.listAdminUsageHistory({
        page,
        limit,
        q: appliedQ || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      setRows(data.items ?? []);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
      setSelected(new Set());
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, limit, appliedQ, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllOnPage() {
    const ids = rows.map((r) => r.id);
    const all = ids.length && ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (all) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  const columns = [
    {
      key: "sel",
      label: (
        <input
          type="checkbox"
          aria-label="Select all on page"
          checked={rows.length > 0 && rows.every((r) => selected.has(r.id))}
          onChange={toggleAllOnPage}
        />
      ),
      render: (r) => (
        <input
          type="checkbox"
          aria-label={`Select ${r.id}`}
          checked={selected.has(r.id)}
          onChange={() => toggle(r.id)}
        />
      ),
    },
    { key: "id", label: "#", render: (r) => r.id },
    {
      key: "who",
      label: "User",
      render: (r) => formatRow(r).who,
    },
    {
      key: "action",
      label: "Action",
      render: (r) => formatRow(r).action,
    },
    {
      key: "lim",
      label: "Limit Δ",
      render: (r) => formatRow(r).lim,
    },
    {
      key: "when",
      label: "When",
      render: (r) => formatRow(r).when,
    },
    {
      key: "summary",
      label: "Summary",
      render: (r) => (
        <span className="line-clamp-2 max-w-xs text-xs text-neutral-600 dark:text-neutral-400">
          {formatRow(r).summary}
        </span>
      ),
    },
  ];

  return (
    <div className="w-full space-y-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="w-full border-b border-neutral-200 pb-6 dark:border-neutral-800">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Audit
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Usage &amp; plan history
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Plan moves, workspace limit changes, and automatic expiry events. Search by user email or
          text in the summary.
        </p>
      </section>

      <Card title="Search">
        <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="min-w-[12rem] flex-1">
            <label className="form-label">Email / text</label>
            <input
              className="form-input w-full"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="user@company.com"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setAppliedQ(q.trim());
                  setPage(1);
                }
              }}
            />
          </div>
          <div>
            <label className="form-label">From</label>
            <input
              type="date"
              className="form-input w-full min-w-[11rem]"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <label className="form-label">To</label>
            <input
              type="date"
              className="form-input w-full min-w-[11rem]"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setAppliedQ(q.trim());
                setPage(1);
              }}
            >
              Search
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setQ("");
                setAppliedQ("");
                setDateFrom("");
                setDateTo("");
                setPage(1);
              }}
            >
              Reset
            </button>
          </div>
        </div>
      </Card>

      <Card
        title="History"
        className="relative"
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-secondary text-sm"
            disabled={selected.size === 0 || loading}
            onClick={async () => {
              if (
                !confirm(
                  `Delete ${selected.size} selected row(s)? This cannot be undone.`,
                )
              ) {
                return;
              }
              try {
                const { deleted } = await adminService.deleteAdminUsageHistory([
                  ...selected,
                ]);
                toast.success(`Deleted ${deleted} row(s).`);
                await load();
              } catch (e) {
                toast.error(e.message);
              }
            }}
          >
            Delete selected
          </button>
        </div>
        {loading ? (
          <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
        ) : (
          <>
            <div className="w-full overflow-x-auto">
              <Table columns={columns} rows={rows} emptyText="No history rows" />
            </div>
            <PaginationBar
              page={page}
              pages={pages}
              total={total}
              limit={limit}
              disabled={loading}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>
    </div>
  );
}
