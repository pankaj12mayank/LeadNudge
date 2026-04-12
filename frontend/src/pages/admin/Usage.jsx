import { useEffect, useState } from "react";
import { toast } from "sonner";
import Card from "../../components/Card";
import Table from "../../components/Table";
import Badge from "../../components/Badge";
import PaginationBar from "../../components/PaginationBar";
import * as adminService from "../../services/adminService";
import * as userService from "../../services/userService";
import { workspaceLabel } from "../../utils/workspaceLabel";

export default function Usage() {
  const [summary, setSummary] = useState({
    users: 0,
    leads: 0,
    followups: 0,
    withAiMessage: 0,
    withAiSampleCapped: false,
  });
  const [rows, setRows] = useState([]);
  const [workspaceIds, setWorkspaceIds] = useState([]);
  const [workspaceFilter, setWorkspaceFilter] = useState("");
  const [usagePage, setUsagePage] = useState(1);
  const usageLimit = 25;
  const [usageData, setUsageData] = useState({
    items: [],
    total: 0,
    pages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [usageLoading, setUsageLoading] = useState(false);
  const [workspacesReady, setWorkspacesReady] = useState(false);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const [users, leads, followups, workspaces] = await Promise.all([
          adminService.listUsers(undefined, { page: 1, limit: 1 }),
          userService.listLeads(undefined, { page: 1, limit: 1 }),
          userService.listFollowups(undefined, { page: 1, limit: 80 }),
          adminService.listWorkspaces(),
        ]);
        const fuItems = followups.items ?? [];
        const withAi = fuItems.filter((f) => f.last_message).length;
        const table = workspaces.map((w) => ({
          id: w.id,
          name: workspaceLabel(w.name),
          plan: w.plan_type,
          usage_limit: w.usage_limit ?? "—",
          ai_mode: w.ai_mode ?? "—",
        }));
        if (!c) {
          setSummary({
            users: users.total ?? 0,
            leads: leads.total ?? 0,
            followups: followups.total ?? 0,
            withAiMessage: withAi,
            withAiSampleCapped: fuItems.length >= 80,
          });
          setRows(table);
          setWorkspaceIds(workspaces);
          const firstId = workspaces[0] ? String(workspaces[0].id) : "";
          setWorkspaceFilter((prev) => {
            if (
              prev &&
              workspaces.some((w) => String(w.id) === prev)
            ) {
              return prev;
            }
            return firstId;
          });
          setWorkspacesReady(true);
        }
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

  useEffect(() => {
    if (loading || !workspacesReady) return;
    const wid = Number(workspaceFilter);
    if (!Number.isFinite(wid) || wid < 1) return;
    let c = false;
    (async () => {
      setUsageLoading(true);
      try {
        const u = await adminService.getUsageUsers({
          workspaceId: wid,
          page: usagePage,
          limit: usageLimit,
        });
        if (!c) setUsageData(u);
      } catch (e) {
        if (!c) toast.error(e.message);
      } finally {
        if (!c) setUsageLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [workspaceFilter, usagePage, loading, workspacesReady, usageLimit]);

  const columns = [
    { key: "id", label: "ID" },
    { key: "name", label: "Workspace" },
    {
      key: "plan",
      label: "Plan",
      render: (r) => (
        <Badge variant={r.plan === "pro" ? "solid" : "muted"}>
          {r.plan === "pro" ? "Paid (Pro)" : "Free"}
        </Badge>
      ),
    },
    { key: "ai_mode", label: "AI mode" },
    { key: "usage_limit", label: "AI message cap" },
  ];

  const userCols = [
    { key: "user_id", label: "User #" },
    { key: "email", label: "Email" },
    {
      key: "is_active",
      label: "Status",
      render: (r) => (
        <Badge variant={r.is_active ? "solid" : "outline"}>
          {r.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "workspace_ai_messages",
      label: "AI messages (workspace)",
      render: (r) => (
        <span className="tabular-nums">{r.workspace_ai_messages}</span>
      ),
    },
  ];

  return (
    <div className="w-full space-y-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="w-full border-b border-neutral-200 pb-6 dark:border-neutral-800">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Reporting
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Reports &amp; per-user AI usage
        </h1>
        <p className="mt-2 w-full text-sm text-neutral-600 dark:text-neutral-400">
          Compare workspace caps and drill into each person in the workspace you select. The
          AI message column is the <strong>total</strong> for that workspace (shared across all
          users in the pool).
        </p>
      </section>
      {loading ? (
        <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Users", summary.users],
              ["Leads", summary.leads],
              ["Follow-ups", summary.followups],
              [
                "With AI Usage",
                summary.withAiSampleCapped
                  ? `${summary.withAiMessage}+`
                  : summary.withAiMessage,
              ],
            ].map(([label, val]) => (
              <Card key={label} noBodyPadding>
                <div className="p-4">
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {label}
                  </p>
                  <p className="text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                    {val}
                  </p>
                </div>
              </Card>
            ))}
          </div>
          <Card title="Per-workspace caps">
            <div className="w-full overflow-x-auto">
              <Table columns={columns} rows={rows} />
            </div>
          </Card>
          <Card title="Users by workspace">
            <div className="mb-4 w-full max-w-md">
              <label className="form-label">Workspace</label>
              <select
                className="form-select w-full"
                value={workspaceFilter}
                onChange={(e) => {
                  setWorkspaceFilter(e.target.value);
                  setUsagePage(1);
                }}
              >
                {workspaceIds.map((w) => (
                  <option key={w.id} value={String(w.id)}>
                    {workspaceLabel(w.name)}
                  </option>
                ))}
              </select>
            </div>
            {usageLoading ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Loading usage…
              </p>
            ) : (
            <div className="w-full overflow-x-auto">
              <Table
                columns={userCols}
                rows={usageData.items}
                emptyText="No users in this workspace"
              />
            </div>
            )}
            <PaginationBar
              page={usagePage}
              pages={usageData.pages}
              total={usageData.total}
              limit={usageLimit}
              disabled={usageLoading}
              onPageChange={setUsagePage}
            />
          </Card>
        </>
      )}
    </div>
  );
}
