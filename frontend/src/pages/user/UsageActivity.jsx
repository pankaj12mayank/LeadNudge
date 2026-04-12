import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import Card from "../../components/Card";
import Table from "../../components/Table";
import PaginationBar from "../../components/PaginationBar";
import * as userService from "../../services/userService";

function formatLine(r) {
  const when = new Date(r.created_at).toLocaleString();
  if (r.summary) return `${r.summary} · ${when}`;
  const bits = [
    r.action_type,
    r.plan_type ? `plan ${r.plan_type}` : null,
    r.old_limit != null && r.new_limit != null
      ? `limit ${r.old_limit}→${r.new_limit}`
      : null,
  ].filter(Boolean);
  return `${bits.join(" · ") || "Update"} · ${when}`;
}

export default function UsageActivity() {
  const [page, setPage] = useState(1);
  const limit = 25;
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(() => new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await userService.listAccountUsageHistory({
        page,
        limit,
        q: appliedQ || undefined,
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
  }, [page, limit, appliedQ]);

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
          aria-label="Select all on this page"
          checked={rows.length > 0 && rows.every((r) => selected.has(r.id))}
          onChange={toggleAllOnPage}
        />
      ),
      render: (r) => (
        <input
          type="checkbox"
          aria-label={`Select row ${r.id}`}
          checked={selected.has(r.id)}
          onChange={() => toggle(r.id)}
        />
      ),
    },
    { key: "id", label: "#", render: (r) => r.id },
    {
      key: "detail",
      label: "Activity",
      render: (r) => (
        <span className="text-sm text-neutral-800 dark:text-neutral-200">
          {formatLine(r)}
        </span>
      ),
    },
  ];

  return (
    <div className="w-full space-y-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="w-full border-b border-neutral-200 pb-6 dark:border-neutral-800">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Your workspace
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Plan &amp; usage activity
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          History of plan changes, limits, and renewals that apply to your account. Search by
          keyword, or delete entries you do not need to keep (your view only).
        </p>
        <Link
          to="/dashboard"
          className="mt-3 inline-block text-sm font-medium text-blue-700 underline dark:text-blue-400"
        >
          ← Back to dashboard
        </Link>
      </section>

      <Card title="Search">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label className="form-label">Search</label>
            <input
              className="form-input w-full"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="e.g. limit, upgrade, expired, admin"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setAppliedQ(q.trim());
                  setPage(1);
                }
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary"
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
                setPage(1);
              }}
            >
              Clear
            </button>
          </div>
        </div>
      </Card>

      <Card title="Activity log">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-secondary text-sm"
            disabled={selected.size === 0 || loading}
            onClick={async () => {
              if (
                !confirm(
                  `Delete ${selected.size} selected row(s) from your log? This cannot be undone.`,
                )
              ) {
                return;
              }
              try {
                const { deleted } = await userService.deleteAccountUsageHistory([
                  ...selected,
                ]);
                toast.success(`Removed ${deleted} row(s).`);
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
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>
        ) : (
          <>
            <div className="w-full overflow-x-auto">
              <Table columns={columns} rows={rows} emptyText="No activity yet" />
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
