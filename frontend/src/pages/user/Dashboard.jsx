import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import Card from "../../components/Card";
import Table from "../../components/Table";
import Badge from "../../components/Badge";
import { useAuthContext } from "../../context/AuthContext";
import { useSite } from "../../context/SiteContext";
import * as userService from "../../services/userService";
import {
  SESSION_PLAN_EXPIRED_TOAST_KEY,
  SESSION_QUOTA_TOAST_KEY,
} from "../../utils/constants";
import { formatScheduleDisplay } from "../../utils/formatSchedule";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "interested", label: "Interested" },
  { value: "not_interested", label: "Not interested" },
  { value: "closed", label: "Closed" },
];

function temperatureVariant(tag) {
  const k = (tag || "").toLowerCase();
  if (k === "hot") return "hot";
  if (k === "warm") return "warm";
  if (k === "cold") return "cold";
  return "muted";
}

export default function Dashboard() {
  const { site } = useSite();
  const { refreshProfile, role } = useAuthContext();
  const supportEmail = site?.support_email;

  const [usageUsed, setUsageUsed] = useState(0);
  const [usageLimit, setUsageLimit] = useState(0);
  const [usageNear, setUsageNear] = useState(false);
  const [planExpired, setPlanExpired] = useState(false);
  const [outboundSent, setOutboundSent] = useState(0);
  const [usageLoading, setUsageLoading] = useState(true);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [summary, setSummary] = useState(null);
  const [dashLoading, setDashLoading] = useState(true);

  const [manualReplies, setManualReplies] = useState(0);
  const [manualConversions, setManualConversions] = useState(0);
  const [manualSaving, setManualSaving] = useState(false);

  const loadUsageRef = useRef(async () => {});

  const loadUsage = useCallback(async () => {
    try {
      if (role === "user") {
        await refreshProfile();
      }
      const s = await userService.getSettings();
      setOutboundSent(s.outbound_emails_sent ?? 0);
      setUsageUsed(s.ai_messages_used ?? 0);
      setUsageLimit(s.usage_limit ?? 0);
      setUsageNear(Boolean(s.usage_near_limit));
      setPlanExpired(Boolean(s.plan_expired));
      if (!s.ai_quota_exhausted) {
        sessionStorage.removeItem(SESSION_QUOTA_TOAST_KEY);
      }
      if (!s.plan_expired) {
        sessionStorage.removeItem(SESSION_PLAN_EXPIRED_TOAST_KEY);
      }
      if (
        s.plan_expired &&
        !sessionStorage.getItem(SESSION_PLAN_EXPIRED_TOAST_KEY)
      ) {
        sessionStorage.setItem(SESSION_PLAN_EXPIRED_TOAST_KEY, "1");
        toast.error("Your workspace plan has expired. Contact admin to renew.", {
          duration: 10_000,
        });
      } else if (
        s.ai_quota_exhausted &&
        !sessionStorage.getItem(SESSION_QUOTA_TOAST_KEY)
      ) {
        sessionStorage.setItem(SESSION_QUOTA_TOAST_KEY, "1");
        toast.error("Your AI message limit has been reached", {
          description:
            "You have used all AI messages allowed for this period. Ask your administrator to raise your limit or update the plan.",
          duration: 14_000,
        });
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setUsageLoading(false);
    }
  }, [refreshProfile, role]);

  useEffect(() => {
    loadUsageRef.current = loadUsage;
  }, [loadUsage]);

  const loadDashboard = useCallback(async () => {
    setDashLoading(true);
    try {
      const data = await userService.getSalesDashboardSummary({
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        status: statusFilter || undefined,
      });
      setSummary(data);
      setManualReplies(data.manual_replies ?? 0);
      setManualConversions(data.manual_conversions ?? 0);
    } catch (e) {
      toast.error(e.message);
      setSummary(null);
    } finally {
      setDashLoading(false);
    }
  }, [dateFrom, dateTo, statusFilter]);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const id = setInterval(() => {
      loadUsageRef.current?.();
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  async function onSaveManualStats(e) {
    e.preventDefault();
    setManualSaving(true);
    try {
      await userService.updateSettings({
        dashboard_manual_replies: Math.max(0, Number(manualReplies) || 0),
        dashboard_manual_conversions: Math.max(0, Number(manualConversions) || 0),
      });
      toast.success("Dashboard counters saved");
      await loadDashboard();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setManualSaving(false);
    }
  }

  const leadColumns = [
    {
      key: "name",
      label: "Name",
      render: (r) => (
        <span className="font-medium text-neutral-900 dark:text-neutral-100">{r.name}</span>
      ),
    },
    {
      key: "email",
      label: "Email",
      render: (r) => (
        <span className="text-neutral-600 dark:text-neutral-400">{r.email}</span>
      ),
    },
    {
      key: "temperature_tag",
      label: "Tag",
      render: (r) => {
        const t = (r.temperature_tag || "").toLowerCase();
        if (!t) return <span className="text-neutral-400">—</span>;
        return (
          <Badge variant={temperatureVariant(r.temperature_tag)}>
            {t === "hot" ? "HOT" : t === "warm" ? "WARM" : t === "cold" ? "COLD" : t}
          </Badge>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (r) => <Badge variant="muted">{r.status}</Badge>,
    },
    {
      key: "created_at",
      label: "Added",
      render: (r) =>
        r.created_at ? formatScheduleDisplay(r.created_at) : "—",
    },
  ];

  const followupColumns = [
    {
      key: "lead_name",
      label: "Lead",
      render: (r) => (
        <span className="font-medium text-neutral-900 dark:text-neutral-100">
          {r.lead_name || `ID ${r.lead_id}`}
        </span>
      ),
    },
    {
      key: "followup_type",
      label: "Type",
      render: (r) => {
        const isRec = (r.followup_type || "normal") === "recovery";
        return (
          <Badge variant={isRec ? "outline" : "muted"}>
            {isRec ? "Recovery" : "Normal"}
          </Badge>
        );
      },
    },
    {
      key: "scheduled_at",
      label: "Scheduled",
      render: (r) => formatScheduleDisplay(r.scheduled_at),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => <Badge variant="muted">{r.status}</Badge>,
    },
    {
      key: "sent_at",
      label: "Sent",
      render: (r) =>
        r.sent_at ? formatScheduleDisplay(r.sent_at) : "—",
    },
  ];

  return (
    <div className="w-full space-y-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="w-full border-b border-neutral-200 pb-6 dark:border-neutral-800">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Sales
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Dashboard
        </h1>
        <p className="mt-2 w-full text-sm text-neutral-600 dark:text-neutral-400">
          Filter by lead creation date and status. Follow-ups sent counts messages marked sent in the
          selected window. Replies and conversions are manual counts you maintain below until inbox
          sync exists.
        </p>
      </section>

      {usageNear && usageLimit > 0 && !planExpired ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-medium">You are reaching your limit. Upgrade plan.</p>
          <p className="mt-1">
            About {Math.min(100, Math.round((usageUsed / usageLimit) * 100))}% of your workspace AI
            allowance is used ({usageUsed} / {usageLimit}). Contact
            {supportEmail ? (
              <>
                {" "}
                <a className="font-medium underline" href={`mailto:${supportEmail}`}>
                  support
                </a>
              </>
            ) : (
              " support"
            )}{" "}
            so an admin can raise your cap.
          </p>
        </div>
      ) : null}

      <Card title="Plan &amp; usage activity">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Open your full activity log to search, review every plan or limit change, and remove old
          entries from your personal list.
        </p>
        <Link
          to="/usage-activity"
          className="mt-3 inline-flex text-sm font-semibold text-blue-700 underline decoration-blue-300 underline-offset-2 dark:text-blue-400"
        >
          Open activity log →
        </Link>
      </Card>

      <Card title="Filters">
        <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
          <div>
            <label className="form-label" htmlFor="dash-from">
              From (lead created)
            </label>
            <input
              id="dash-from"
              type="date"
              className="form-input w-full min-w-[11rem]"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="dash-to">
              To (lead created)
            </label>
            <input
              id="dash-to"
              type="date"
              className="form-input w-full min-w-[11rem]"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <div className="min-w-[12rem]">
            <label className="form-label" htmlFor="dash-status">
              Status
            </label>
            <select
              id="dash-status"
              className="form-select w-full"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={() => loadDashboard()}>
              Refresh
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setStatusFilter("");
              }}
            >
              Clear filters
            </button>
          </div>
        </div>
      </Card>

      {dashLoading && !summary ? (
        <p className="text-neutral-500 dark:text-neutral-400">Loading dashboard…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card noBodyPadding>
            <div className="p-6">
              <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                Total leads
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                {summary?.total_leads ?? 0}
              </p>
            </div>
          </Card>
          <Card noBodyPadding>
            <div className="p-6">
              <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                Follow-ups sent
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                {summary?.followups_sent ?? 0}
              </p>
            </div>
          </Card>
          <Card noBodyPadding>
            <div className="p-6">
              <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                Replies (manual)
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                {summary?.manual_replies ?? 0}
              </p>
            </div>
          </Card>
          <Card noBodyPadding>
            <div className="p-6">
              <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                Conversions (manual)
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                {summary?.manual_conversions ?? 0}
              </p>
            </div>
          </Card>
        </div>
      )}

      <Card title="Manual replies & conversions">
        <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
          Enter totals you track outside the app (for example from your inbox). These feed the
          dashboard cards above.
        </p>
        <form onSubmit={onSaveManualStats} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="form-label" htmlFor="manual-replies">
              Replies count
            </label>
            <input
              id="manual-replies"
              type="number"
              min={0}
              className="form-input w-full"
              value={manualReplies}
              onChange={(e) => setManualReplies(e.target.value)}
              disabled={manualSaving}
            />
          </div>
          <div className="flex-1">
            <label className="form-label" htmlFor="manual-conv">
              Conversions count
            </label>
            <input
              id="manual-conv"
              type="number"
              min={0}
              className="form-input w-full"
              value={manualConversions}
              onChange={(e) => setManualConversions(e.target.value)}
              disabled={manualSaving}
            />
          </div>
          <button type="submit" className="btn-primary shrink-0" disabled={manualSaving}>
            {manualSaving ? "Saving…" : "Save counts"}
          </button>
        </form>
      </Card>

      {!usageLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card noBodyPadding>
            <div className="p-6">
              <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                Emails sent (SMTP)
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                {outboundSent}
              </p>
              <Link
                to="/sent-mails"
                className="mt-2 inline-block text-xs font-medium text-neutral-600 underline dark:text-neutral-400"
              >
                View log
              </Link>
            </div>
          </Card>
          <Card noBodyPadding>
            <div className="p-6">
              <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                AI messages used
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                {usageLimit > 0 ? `${usageUsed} / ${usageLimit}` : usageUsed}
              </p>
              <p className="mt-2 text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Status:{" "}
                {planExpired
                  ? "Plan expired"
                  : usageLimit > 0 && usageUsed >= usageLimit
                    ? "Limit reached"
                    : "Active"}
              </p>
            </div>
          </Card>
        </div>
      ) : null}

      <Card
        title="Recent leads"
        actions={
          <Link to="/leads" className="text-sm font-medium text-neutral-700 underline dark:text-neutral-300">
            Manage all
          </Link>
        }
      >
        {dashLoading ? (
          <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <Table
              columns={leadColumns}
              rows={summary?.recent_leads ?? []}
              emptyText="No leads in this view."
            />
          </div>
        )}
      </Card>

      <Card
        title="Recent follow-ups"
        actions={
          <Link to="/followups" className="text-sm font-medium text-neutral-700 underline dark:text-neutral-300">
            View all
          </Link>
        }
      >
        {dashLoading ? (
          <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <Table
              columns={followupColumns}
              rows={summary?.recent_followups ?? []}
              emptyText="No follow-ups in this view."
            />
          </div>
        )}
      </Card>
    </div>
  );
}
