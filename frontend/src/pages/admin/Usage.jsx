import { useEffect, useState } from "react";
import { toast } from "sonner";
import Card from "../../components/Card";
import Table from "../../components/Table";
import Badge from "../../components/Badge";
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

  return (
    <div className="space-y-8 p-4 lg:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Usage
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
          <strong>Free</strong> and <strong>Pro</strong> are the two fixed workspaces. Each has its
          own AI message cap; you can override per workspace in AI configuration.
        </p>
      </div>
      {loading ? (
        <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Users", summary.users],
              ["Leads", summary.leads],
              ["Follow-ups", summary.followups],
              ["With AI draft text (sample)", summary.withAiMessage],
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
            <Table columns={columns} rows={rows} />
          </Card>
        </>
      )}
    </div>
  );
}
