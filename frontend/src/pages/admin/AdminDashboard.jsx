import { useEffect, useState } from "react";
import { toast } from "sonner";
import Card from "../../components/Card";
import PaginationBar from "../../components/PaginationBar";
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
  const [loading, setLoading] = useState(true);

  const [actPage, setActPage] = useState(1);
  const actLimit = 12;
  const [actPeriod, setActPeriod] = useState("");
  const [activityData, setActivityData] = useState({
    items: [],
    total: 0,
    pages: 1,
  });
  const [actLoading, setActLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [users, leads, followups, workspaces, sys] = await Promise.all([
          adminService.listUsers(undefined, { page: 1, limit: 1 }),
          userService.listLeads(undefined, { page: 1, limit: 1 }),
          userService.listFollowups(undefined, { page: 1, limit: 1 }),
          adminService.listWorkspaces(),
          adminService.getSystemStatus(),
        ]);
        if (!cancelled) {
          setStats({
            users: users.total ?? 0,
            leads: leads.total ?? 0,
            followups: followups.total ?? 0,
            workspaces: workspaces.length,
          });
          setStatus(sys);
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setActLoading(true);
      try {
        const data = await adminService.getAdminActivity({
          page: actPage,
          limit: actLimit,
          period: actPeriod || undefined,
        });
        if (!cancelled) setActivityData(data);
      } catch (e) {
        if (!cancelled) toast.error(e.message);
      } finally {
        if (!cancelled) setActLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [actPage, actPeriod, actLimit]);

  async function clearActivity(range) {
    if (!confirm(`Remove activity log entries for the selected period (${range})?`)) return;
    try {
      await adminService.clearAdminActivity(range);
      toast.success("Activity cleared.");
      setActPage(1);
      const data = await adminService.getAdminActivity({
        page: 1,
        limit: actLimit,
        period: actPeriod || undefined,
      });
      setActivityData(data);
    } catch (e) {
      toast.error(e.message);
    }
  }

  const cards = [
    { label: "Workspaces", value: stats.workspaces },
    { label: "Users", value: stats.users },
    { label: "Leads (all)", value: stats.leads },
    { label: "Follow-ups", value: stats.followups },
  ];

  const lastAct = status?.last_activity_at
    ? new Date(status.last_activity_at).toLocaleString()
    : "—";

  const activityItems = activityData.items ?? [];

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
          High-level counts, backend/AI status, and recorded activity (new entries appear when
          follow-up drafts are generated).
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
                  <dt className="text-neutral-500 dark:text-neutral-400">AI services</dt>
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
                    Last recorded message activity
                  </dt>
                  <dd className="text-neutral-800 dark:text-neutral-200">{lastAct}</dd>
                </div>
              </dl>
            )}
          </Card>

          <Card title="Recent activity">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <label className="form-label mb-0">Period</label>
                <select
                  className="form-select w-auto min-w-[10rem]"
                  value={actPeriod}
                  onChange={(e) => {
                    setActPeriod(e.target.value);
                    setActPage(1);
                  }}
                >
                  <option value="">All recent</option>
                  <option value="week">Weekly (last 7 days)</option>
                  <option value="month">Monthly (last 30 days)</option>
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  onClick={() => clearActivity("week")}
                >
                  Clear weekly
                </button>
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  onClick={() => clearActivity("month")}
                >
                  Clear monthly
                </button>
              </div>
            </div>
            {actLoading ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading activity…</p>
            ) : activityItems.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                No activity entries yet. They are added when AI follow-up drafts are saved.
              </p>
            ) : (
              <ul className="mb-4 max-h-96 space-y-2 overflow-y-auto text-sm">
                {activityItems.map((a) => (
                  <li
                    key={`${a.occurred_at}-${a.summary?.slice(0, 40)}`}
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
            <PaginationBar
              page={actPage}
              pages={activityData.pages ?? 1}
              total={activityData.total ?? 0}
              limit={actLimit}
              disabled={actLoading}
              onPageChange={setActPage}
            />
          </Card>
        </>
      )}
    </div>
  );
}
