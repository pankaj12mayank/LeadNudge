import { useEffect, useState } from "react";
import { toast } from "sonner";
import Card from "../../components/Card";
import Table from "../../components/Table";
import Badge from "../../components/Badge";
import * as adminService from "../../services/adminService";
import { workspaceLabel } from "../../utils/workspaceLabel";

export default function Workspaces() {
  const [rows, setRows] = useState([]);
  const [pending, setPending] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  async function refresh() {
    const data = await adminService.listWorkspaces();
    setRows(data);
  }

  useEffect(() => {
    let c = false;
    (async () => {
      setLoading(true);
      try {
        await refresh();
      } catch (e) {
        if (!c) toast.error(e.message);
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  async function savePlan(workspaceId, planType) {
    setSavingId(workspaceId);
    try {
      await adminService.updateWorkspacePlan(workspaceId, planType);
      toast.success("Workspace plan updated");
      setPending((p) => ({ ...p, [workspaceId]: undefined }));
      await refresh();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingId(null);
    }
  }

  const columns = [
    { key: "id", label: "ID" },
    {
      key: "name",
      label: "Workspace",
      render: (r) => workspaceLabel(r.name),
    },
    {
      key: "plan_type",
      label: "Plan",
      render: (r) => {
        const current = r.plan_type ?? "free";
        const sel = pending[r.id] !== undefined ? pending[r.id] : current;
        return (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={current === "pro" ? "solid" : "muted"}>
              {current === "pro" ? "Paid (Pro)" : "Free"}
            </Badge>
            <select
              className="form-select max-w-[200px] py-1 text-xs"
              value={sel}
              disabled={savingId === r.id}
              onChange={(e) =>
                setPending((p) => ({ ...p, [r.id]: e.target.value }))
              }
            >
              <option value="free">Free</option>
              <option value="pro">Paid (Pro)</option>
            </select>
            {pending[r.id] !== undefined && pending[r.id] !== current && (
              <button
                type="button"
                className="text-xs font-medium underline decoration-neutral-400 underline-offset-2"
                disabled={savingId === r.id}
                onClick={() => savePlan(r.id, pending[r.id])}
              >
                Apply
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-8 p-4 lg:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Workspaces
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
          The system uses <strong>two fixed workspaces</strong>: one for Free-plan tenants and one
          for Pro. You cannot add new workspaces. Adjust each plan&apos;s AI message cap defaults
          here (and fine-tune in AI configuration). Users are assigned to Free or Pro when you create
          them under Team users.
        </p>
      </div>

      <Card title="System workspaces">
        {loading ? (
          <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
        ) : (
          <Table columns={columns} rows={rows} emptyText="No workspaces" />
        )}
      </Card>
    </div>
  );
}
