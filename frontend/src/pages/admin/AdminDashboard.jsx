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
  const [status, setStatus] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [users, leads, followups, workspaces, sys, act] =
          await Promise.all([
            adminService.listUsers(undefined, { page: 1, limit: 1 }),
            userService.listLeads(undefined, { page: 1, limit: 1 }),
            userService.listFollowups(undefined, { page: 1, limit: 1 }),
            adminService.listWorkspaces(),
            adminService.getSystemStatus(),
            adminService.getAdminActivity(12),
          ]);
        if (!cancelled) {
          setStats({
            users: users.total ?? 0,
            leads: leads.total ?? 0,
            followups: followups.total ?? 0,
            workspaces: workspaces.length,
          });
          setStatus(sys);
          setActivity(act || []);
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

  const lastAct = status?.last_activity_at
    ? new Date(status.last_activity_at).toLocaleString()
    : "—";

  return (
    <div className="w-full space-y-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="w-full border-b border-neutral-200 pb-6 dark:border-neutral-800">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Admin home
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Live operations &amp; system health
        </h1>
        <p className="mt-2 w-full text-sm text-neutral-600 dark:text-neutral-400">
          High-level counts, backend/AI status, and the latest draft activity across all
          workspaces.
        </p>
      </section>

      {loading ? (
        <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
      ) : (
        <>
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

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="System status">
              {status && (
                <dl className="space-y-3 text-sm">
                  <div className="flex flex-wrap justify-between gap-2 border-b border-neutral-100 pb-2 dark:border-neutral-800">
                    <dt className="text-neutral-500 dark:text-neutral-400">
                      Application server
                    </dt>
                    <dd className="font-medium capitalize text-emerald-700 dark:text-emerald-400">
                      {status.backend}
                    </dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2 border-b border-neutral-100 pb-2 dark:border-neutral-800">
                    <dt className="text-neutral-500 dark:text-neutral-400">
                      AI services
                    </dt>
                    <dd
                      className={
                        status.ai_active
                          ? "font-medium text-emerald-700 dark:text-emerald-400"
                          : "font-medium text-amber-700 dark:text-amber-400"
                      }
                    >
                      {status.ai_active ? "Active" : "Inactive"}
                    </dd>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {status.ai_message}
                  </p>
                  <div className="flex flex-wrap justify-between gap-2 pt-1">
                    <dt className="text-neutral-500 dark:text-neutral-400">
                      Last recorded activity
                    </dt>
                    <dd className="text-neutral-800 dark:text-neutral-200">
                      {lastAct}
                    </dd>
                  </div>
                </dl>
              )}
            </Card>

            <Card title="Recent activity">
              {activity.length === 0 ? (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  No recent AI drafts yet.
                </p>
              ) : (
                <ul className="max-h-72 space-y-2 overflow-y-auto text-sm">
                  {activity.map((a) => (
                    <li
                      key={`${a.occurred_at}-${a.summary}`}
                      className="rounded-md border border-neutral-100 px-3 py-2 dark:border-neutral-800"
                    >
                      <p className="font-medium text-neutral-800 dark:text-neutral-200">
                        {a.summary}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {new Date(a.occurred_at).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
