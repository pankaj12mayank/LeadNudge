import { useEffect, useState } from "react";
import { toast } from "sonner";
import Card from "../../components/Card";
import * as adminService from "../../services/adminService";
import * as userService from "../../services/userService";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    users: 0,
    leads: 0,
    followups: 0,
    workspaces: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [users, leads, followups, workspaces] = await Promise.all([
          adminService.listUsers(undefined, { page: 1, limit: 1 }),
          userService.listLeads(undefined, { page: 1, limit: 1 }),
          userService.listFollowups(undefined, { page: 1, limit: 1 }),
          adminService.listWorkspaces(),
        ]);
        if (!cancelled) {
          setStats({
            users: users.total ?? 0,
            leads: leads.total ?? 0,
            followups: followups.total ?? 0,
            workspaces: workspaces.length,
          });
        }
      } catch (e) {
        if (!cancelled) toast.error(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = [
    { label: "Workspaces", value: stats.workspaces },
    { label: "Users", value: stats.users },
    { label: "Leads (all)", value: stats.leads },
    { label: "Follow-ups", value: stats.followups },
  ];

  return (
    <div className="space-y-8 p-4 lg:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Overview
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Cross-workspace totals. Open <strong>Team users</strong> or{" "}
          <strong>Workspaces</strong> to manage access.
        </p>
      </div>
      {loading ? (
        <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((c) => (
            <Card key={c.label} noBodyPadding>
              <div className="p-5">
                <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                  {c.label}
                </p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                  {c.value}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
