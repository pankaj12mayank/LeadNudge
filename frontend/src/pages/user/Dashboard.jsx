import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import Card from "../../components/Card";
import Table from "../../components/Table";
import Badge from "../../components/Badge";
import PaginationBar from "../../components/PaginationBar";
import { useSite } from "../../context/SiteContext";
import * as userService from "../../services/userService";

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
    key: "status",
    label: "Status",
    render: (r) => <Badge variant="muted">{r.status}</Badge>,
  },
];

export default function Dashboard() {
  const { site } = useSite();
  const supportEmail = site?.support_email;
  const [leads, setLeads] = useState(0);
  const [followups, setFollowups] = useState(0);
  const [outboundSent, setOutboundSent] = useState(0);
  const [usageUsed, setUsageUsed] = useState(0);
  const [usageLimit, setUsageLimit] = useState(0);
  const [usageNear, setUsageNear] = useState(false);
  const [loading, setLoading] = useState(true);

  const [dashPage, setDashPage] = useState(1);
  const dashLimit = 8;
  const [dashRows, setDashRows] = useState([]);
  const [dashTotal, setDashTotal] = useState(0);
  const [dashPages, setDashPages] = useState(1);
  const [dashQInput, setDashQInput] = useState("");
  const [dashQ, setDashQ] = useState("");
  const [dashLoading, setDashLoading] = useState(false);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const [l, f, s] = await Promise.all([
          userService.listLeads(undefined, { page: 1, limit: 1 }),
          userService.listFollowups(undefined, { page: 1, limit: 1 }),
          userService.getSettings(),
        ]);
        if (!c) {
          setLeads(l.total ?? 0);
          setFollowups(f.total ?? 0);
          setOutboundSent(s.outbound_emails_sent ?? 0);
          setUsageUsed(s.ai_messages_used ?? 0);
          setUsageLimit(s.usage_limit ?? 0);
          setUsageNear(Boolean(s.usage_near_limit));
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
    const id = setInterval(async () => {
      try {
        const s = await userService.getSettings();
        setOutboundSent(s.outbound_emails_sent ?? 0);
        setUsageUsed(s.ai_messages_used ?? 0);
        setUsageLimit(s.usage_limit ?? 0);
        setUsageNear(Boolean(s.usage_near_limit));
      } catch {
        /* ignore */
      }
    }, 35000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setDashLoading(true);
      try {
        const data = await userService.listLeads(undefined, {
          page: dashPage,
          limit: dashLimit,
          q: dashQ || undefined,
        });
        if (!cancelled) {
          setDashRows(data.items ?? []);
          setDashTotal(data.total ?? 0);
          setDashPages(data.pages ?? 1);
        }
      } catch (e) {
        if (!cancelled) toast.error(e.message);
      } finally {
        if (!cancelled) setDashLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dashPage, dashLimit, dashQ]);

  return (
    <div className="w-full space-y-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="w-full border-b border-neutral-200 pb-6 dark:border-neutral-800">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Today
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Workspace snapshot
        </h1>
        <p className="mt-2 w-full text-sm text-neutral-600 dark:text-neutral-400">
          Totals reflect your workspace only. Follow-ups run at the time you schedule; with SMTP
          configured the app can email the lead and log the send here. AI drafts count toward your
          plan limit.
        </p>
      </section>
      {usageNear && usageLimit > 0 ? (
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
      {loading ? (
        <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card noBodyPadding>
            <div className="p-6">
              <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                Leads
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                {leads}
              </p>
            </div>
          </Card>
          <Card noBodyPadding>
            <div className="p-6">
              <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                Follow-ups
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                {followups}
              </p>
            </div>
          </Card>
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
            </div>
          </Card>
        </div>
      )}

      <Card
        title="Recent leads"
        actions={
          <Link to="/leads" className="text-sm font-medium text-neutral-700 underline dark:text-neutral-300">
            Manage all
          </Link>
        }
      >
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label className="form-label">Search</label>
            <input
              className="form-input w-full"
              placeholder="Name or email"
              value={dashQInput}
              onChange={(e) => setDashQInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  setDashPage(1);
                  setDashQ(dashQInput.trim());
                }
              }}
            />
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <button
              type="button"
              className="btn-primary w-full sm:w-auto"
              onClick={() => {
                setDashPage(1);
                setDashQ(dashQInput.trim());
              }}
            >
              Search
            </button>
            <button
              type="button"
              className="btn-secondary w-full sm:w-auto"
              onClick={() => {
                setDashQInput("");
                setDashQ("");
                setDashPage(1);
              }}
            >
              Clear
            </button>
          </div>
        </div>
        {dashLoading ? (
          <p className="text-neutral-500 dark:text-neutral-400">Loading leads…</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table columns={leadColumns} rows={dashRows} emptyText="No leads match." />
            </div>
            <PaginationBar
              page={dashPage}
              pages={dashPages}
              total={dashTotal}
              limit={dashLimit}
              disabled={dashLoading}
              onPageChange={(p) => setDashPage(p)}
            />
          </>
        )}
      </Card>
    </div>
  );
}
