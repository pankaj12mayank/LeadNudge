import { useEffect, useState } from "react";
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

  async function load() {
    setLoading(true);
    try {
      const data = await adminService.listPasswordRequests({ page, limit });
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [page]);

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
              navigate("/admin/users", { state: { presetSearch: r.user_email } })
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
