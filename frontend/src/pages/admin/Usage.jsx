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

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const [users, leads, followups, workspaces] = await Promise.all([
          adminService.listUsers(undefined, { page: 1, limit: 1 }),
          userService.listLeads(undefined, { page: 1, limit: 1 }),
          userService.listFollowups(undefined, { page: 1, limit: 500 }),
          adminService.listWorkspaces(),
        ]);
        const fuItems = followups.items ?? [];
        const withAi = fuItems.filter((f) => f.last_message).length;
        const settingsList = await Promise.all(
          workspaces.map((w) =>
            adminService.getSettings(w.id).catch(() => null),
          ),
        );
        const table = workspaces.map((w, i) => {
          const s = settingsList[i];
          return {
            id: w.id,
            name: workspaceLabel(w.name),
            plan: w.plan_type,
            usage_limit: s?.usage_limit ?? "—",
            ai_mode: s?.ai_mode ?? "—",
          };
        });
        if (!c) {
          setSummary({
            users: users.total ?? 0,
            leads: leads.total ?? 0,
            followups: followups.total ?? 0,
            withAiMessage: withAi,
          });
          setRows(table);
          setWorkspaceIds(workspaces);
          if (workspaces[0]) {
            setWorkspaceFilter((prev) => prev || String(workspaces[0].id));
          }
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
    if (!workspaceFilter) return;
    let c = false;
    (async () => {
      try {
        const u = await adminService.getUsageUsers({
          workspaceId: Number(workspaceFilter),
          page: usagePage,
          limit: usageLimit,
        });
        if (!c) setUsageData(u);
      } catch (e) {
        if (!c) toast.error(e.message);
      }
    })();
    return () => {
      c = true;
    };
  }, [workspaceFilter, usagePage]);

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
          Compare workspace caps and drill into each person&apos;s AI message count in the
          workspace you select.
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
              ["With AI draft (sample)", summary.withAiMessage],
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
                  <option key={w.id} value={w.id}>
                    {workspaceLabel(w.name)}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full overflow-x-auto">
              <Table
                columns={userCols}
                rows={usageData.items}
                emptyText="No users in this workspace"
              />
            </div>
            <PaginationBar
              page={usagePage}
              pages={usageData.pages}
              total={usageData.total}
              limit={usageLimit}
              onPageChange={setUsagePage}
            />
          </Card>
        </>
      )}
    </div>
  );
}
