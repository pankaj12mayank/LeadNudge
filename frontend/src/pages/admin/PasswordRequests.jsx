import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import Card from "../../components/Card";
import Table from "../../components/Table";
import PaginationBar from "../../components/PaginationBar";
import Badge from "../../components/Badge";
import * as adminService from "../../services/adminService";
import { formatScheduleDisplay } from "../../utils/formatSchedule";

export default function PasswordRequests() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const limit = 25;
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [qInput, setQInput] = useState("");
  const [statusInput, setStatusInput] = useState("");
  const [qApplied, setQApplied] = useState("");
  const [statusApplied, setStatusApplied] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminService.listPasswordRequests({
        page,
        limit,
        q: qApplied || undefined,
        status: statusApplied || undefined,
      });
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, limit, qApplied, statusApplied]);

  useEffect(() => {
    load();
  }, [load]);

  function onApplyFilters(e) {
    e.preventDefault();
    setQApplied(qInput.trim());
    setStatusApplied(statusInput);
    setPage(1);
  }

  function onClearFilters() {
    setQInput("");
    setStatusInput("");
    setQApplied("");
    setStatusApplied("");
    setPage(1);
  }

  async function onResolve(row) {
    if (row.status !== "pending") return;
    try {
      await adminService.resolvePasswordRequest(row.id);
      toast.success("Marked resolved");
      await load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  const columns = [
    { key: "id", label: "#" },
    { key: "user_email", label: "Email" },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge variant={r.status === "pending" ? "outline" : "muted"}>
          {r.status}
        </Badge>
      ),
    },
    {
      key: "created_at",
      label: "Requested",
      render: (r) => formatScheduleDisplay(r.created_at),
    },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="text-xs font-medium text-blue-700 underline decoration-blue-300 underline-offset-2 dark:text-blue-400"
            onClick={() =>
              navigate("/admin/users", {
                state: { presetSearch: r.user_email },
              })
            }
          >
            Open in Team
          </button>
          {r.status === "pending" ? (
            <button
              type="button"
              className="text-xs font-medium underline decoration-neutral-400 underline-offset-2"
              onClick={() => onResolve(r)}
            >
              Mark resolved
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="w-full space-y-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="border-b border-neutral-200 pb-6 dark:border-neutral-800">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Access
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Password requests
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Users who used &quot;Request password reset&quot; on the sign-in page. Set a new password
          under Team users, then mark the row resolved when done.
        </p>
      </section>

      <Card title="Search & filter">
        <form
          onSubmit={onApplyFilters}
          className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end"
        >
          <div className="min-w-[200px] flex-1">
            <label className="form-label" htmlFor="pr-q">
              Email contains
            </label>
            <input
              id="pr-q"
              className="form-input w-full"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="user@company.com"
              disabled={loading}
            />
          </div>
          <div className="w-full sm:w-44">
            <label className="form-label" htmlFor="pr-status">
              Status
            </label>
            <select
              id="pr-status"
              className="form-input w-full"
              value={statusInput}
              onChange={(e) => setStatusInput(e.target.value)}
              disabled={loading}
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-primary" disabled={loading}>
              Apply
            </button>
            <button
              type="button"
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-900"
              onClick={onClearFilters}
              disabled={loading}
            >
              Clear
            </button>
          </div>
        </form>
      </Card>

      <Card title="Queue">
        {loading ? (
          <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
        ) : (
          <>
            <Table columns={columns} rows={items} emptyText="No requests" />
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
