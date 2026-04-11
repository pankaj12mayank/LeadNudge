import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import Table from "../../components/Table";
import PaginationBar from "../../components/PaginationBar";
import * as adminService from "../../services/adminService";

function formatIso(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function currentMonthValue() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function parseMonthValue(v) {
  const [ys, ms] = String(v || "").split("-");
  const year = Number(ys);
  const month = Number(ms);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  return { year, month };
}

export default function AdminLogs() {
  const [activeTab, setActiveTab] = useState("logs");

  const [logPage, setLogPage] = useState(1);
  const [logType, setLogType] = useState("all");
  const logLimit = 25;
  const [logs, setLogs] = useState({ items: [], total: 0, pages: 1 });
  const [logLoading, setLogLoading] = useState(true);
  const [logSelectedIds, setLogSelectedIds] = useState(() => new Set());
  const [logDeleting, setLogDeleting] = useState(false);
  const [monthClearValue, setMonthClearValue] = useState(currentMonthValue);

  const [mailPage, setMailPage] = useState(1);
  const mailLimit = 25;
  const [mails, setMails] = useState({ items: [], total: 0, pages: 1 });
  const [mailLoading, setMailLoading] = useState(false);
  const [mailSelectedIds, setMailSelectedIds] = useState(() => new Set());
  const [mailDeleting, setMailDeleting] = useState(false);

  const logIdsOnPage = useMemo(
    () => new Set((logs.items ?? []).map((r) => r.id)),
    [logs.items],
  );

  const mailIdsOnPage = useMemo(
    () => new Set((mails.items ?? []).map((r) => r.id)),
    [mails.items],
  );

  const allLogsOnPageSelected =
    logIdsOnPage.size > 0 &&
    [...logIdsOnPage].every((id) => logSelectedIds.has(id));

  const allMailOnPageSelected =
    mailIdsOnPage.size > 0 &&
    [...mailIdsOnPage].every((id) => mailSelectedIds.has(id));

  useEffect(() => {
    setLogSelectedIds(new Set());
  }, [logPage, logType]);

  useEffect(() => {
    if (activeTab !== "logs") return;
    let c = false;
    (async () => {
      setLogLoading(true);
      try {
        const data = await adminService.getSystemLogs({
          page: logPage,
          limit: logLimit,
          log_type: logType === "all" ? undefined : logType,
        });
        if (!c) setLogs(data);
      } catch (e) {
        if (!c) toast.error(e.message);
      } finally {
        if (!c) setLogLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [activeTab, logPage, logType, logLimit]);

  useEffect(() => {
    if (activeTab !== "mail") return;
    let c = false;
    (async () => {
      setMailLoading(true);
      try {
        const data = await adminService.listAdminSentEmails({
          page: mailPage,
          limit: mailLimit,
        });
        if (!c) {
          setMails(data);
          setMailSelectedIds(new Set());
        }
      } catch (e) {
        if (!c) toast.error(e.message);
      } finally {
        if (!c) setMailLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [activeTab, mailPage, mailLimit]);

  async function reloadLogs() {
    const data = await adminService.getSystemLogs({
      page: logPage,
      limit: logLimit,
      log_type: logType === "all" ? undefined : logType,
    });
    setLogs(data);
    setLogSelectedIds(new Set());
  }

  function selectAllLogsOnPage() {
    setLogSelectedIds(new Set(logIdsOnPage));
  }

  function clearLogSelection() {
    setLogSelectedIds(new Set());
  }

  async function onDeleteSelectedLogs() {
    const ids = [...logSelectedIds];
    if (!ids.length) {
      toast.warning("Select at least one log row.");
      return;
    }
    if (
      !confirm(
        `Delete ${ids.length} system log row(s)? This cannot be undone.`,
      )
    )
      return;
    setLogDeleting(true);
    try {
      const { deleted } = await adminService.deleteSystemLogs(ids);
      toast.success(deleted ? `Deleted ${deleted} row(s).` : "Nothing deleted.");
      await reloadLogs();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLogDeleting(false);
    }
  }

  async function onClearLogsMonth() {
    const parsed = parseMonthValue(monthClearValue);
    if (!parsed) {
      toast.warning("Pick a valid month.");
      return;
    }
    const label = new Date(parsed.year, parsed.month - 1, 1).toLocaleString(
      undefined,
      { month: "long", year: "numeric" },
    );
    if (
      !confirm(
        `Delete ALL system logs for ${label} (UTC calendar month)? This cannot be undone.`,
      )
    )
      return;
    setLogDeleting(true);
    try {
      const { deleted } = await adminService.clearSystemLogsMonth(
        parsed.year,
        parsed.month,
      );
      toast.success(
        deleted
          ? `Deleted ${deleted} log row(s) for that month.`
          : "No rows in that month.",
      );
      await reloadLogs();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLogDeleting(false);
    }
  }

  function selectAllMailOnPage() {
    setMailSelectedIds(new Set(mailIdsOnPage));
  }

  function clearMailSelection() {
    setMailSelectedIds(new Set());
  }

  async function onDeleteSelectedMail() {
    const ids = [...mailSelectedIds];
    if (!ids.length) {
      toast.warning("Select at least one row.");
      return;
    }
    if (!confirm(`Delete ${ids.length} sent-email log row(s)?`)) return;
    setMailDeleting(true);
    try {
      await adminService.deleteAdminSentEmails(ids);
      toast.success("Deleted.");
      const data = await adminService.listAdminSentEmails({
        page: mailPage,
        limit: mailLimit,
      });
      setMails(data);
      setMailSelectedIds(new Set());
    } catch (e) {
      toast.error(e.message);
    } finally {
      setMailDeleting(false);
    }
  }

  const logColumns = [
    {
      key: "_sel",
      label: "",
      render: (r) => (
        <input
          type="checkbox"
          checked={logSelectedIds.has(r.id)}
          onChange={(e) => {
            const next = new Set(logSelectedIds);
            if (e.target.checked) next.add(r.id);
            else next.delete(r.id);
            setLogSelectedIds(next);
          }}
          aria-label={`Select log ${r.id}`}
        />
      ),
    },
    { key: "id", label: "ID" },
    { key: "type", label: "Type" },
    {
      key: "message",
      label: "Message",
      render: (r) => (
        <pre className="max-h-40 min-w-0 max-w-none overflow-auto whitespace-pre-wrap break-words text-xs text-neutral-700 dark:text-neutral-300">
          {r.message}
        </pre>
      ),
    },
    {
      key: "created_at",
      label: "When",
      render: (r) => formatIso(r.created_at),
    },
  ];

  const mailColumns = [
    {
      key: "_sel",
      label: "",
      render: (r) => (
        <input
          type="checkbox"
          checked={mailSelectedIds.has(r.id)}
          onChange={(e) => {
            const next = new Set(mailSelectedIds);
            if (e.target.checked) next.add(r.id);
            else next.delete(r.id);
            setMailSelectedIds(next);
          }}
          aria-label={`Select ${r.id}`}
        />
      ),
    },
    { key: "id", label: "ID" },
    { key: "to_email", label: "To" },
    { key: "subject", label: "Subject" },
    {
      key: "status",
      label: "Status",
      render: (r) => r.status,
    },
    {
      key: "sent_at",
      label: "Sent",
      render: (r) => formatIso(r.sent_at),
    },
    {
      key: "body",
      label: "Body",
      render: (r) => (
        <span className="line-clamp-3 min-w-0 max-w-none text-xs text-neutral-600 dark:text-neutral-400">
          {r.body}
        </span>
      ),
    },
  ];

  const tabBtn =
    "inline-flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition sm:flex-none sm:px-6";
  const tabActive =
    "border-b-2 border-blue-600 bg-white text-blue-700 dark:border-blue-500 dark:bg-neutral-950 dark:text-blue-400";
  const tabIdle =
    "border-b-2 border-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100";

  return (
    <div className="w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="w-full border-b border-neutral-200 pb-6 dark:border-neutral-800">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Diagnostics
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Logs &amp; mail
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-neutral-600 dark:text-neutral-400">
          Use the tabs to switch between system diagnostics and the global sent-mail history. Only
          the active tab loads its data.
        </p>
      </section>

      <div className="w-full max-w-none rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-950">
        <div
          className="flex border-b border-neutral-200 dark:border-neutral-700"
          role="tablist"
          aria-label="Log views"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "logs"}
            id="tab-logs"
            className={`${tabBtn} ${activeTab === "logs" ? tabActive : tabIdle}`}
            onClick={() => setActiveTab("logs")}
          >
            System logs
            {!logLoading && activeTab === "logs" ? (
              <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-normal text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                {logs.total ?? 0}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "mail"}
            id="tab-mail"
            className={`${tabBtn} ${activeTab === "mail" ? tabActive : tabIdle}`}
            onClick={() => setActiveTab("mail")}
          >
            Sent emails
            {!mailLoading && activeTab === "mail" ? (
              <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-normal text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                {mails.total ?? 0}
              </span>
            ) : null}
          </button>
        </div>

        <div className="p-5 sm:p-6" role="tabpanel" aria-labelledby={activeTab === "logs" ? "tab-logs" : "tab-mail"}>
          {activeTab === "logs" ? (
            <div className="w-full space-y-5">
              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-lg border border-neutral-200 bg-neutral-50/80 p-4 dark:border-neutral-700 dark:bg-neutral-900/40">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Filter
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                    <label
                      className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
                      htmlFor="log-type-filter"
                    >
                      Log type
                    </label>
                    <select
                      id="log-type-filter"
                      className="form-select h-10 w-full min-w-0 sm:max-w-[220px]"
                      value={logType}
                      onChange={(e) => {
                        setLogType(e.target.value);
                        setLogPage(1);
                      }}
                    >
                      <option value="all">All</option>
                      <option value="AI">AI</option>
                      <option value="EMAIL">EMAIL</option>
                      <option value="ERROR">ERROR</option>
                      <option value="ACTIVITY">ACTIVITY</option>
                    </select>
                  </div>
                </div>

                <div className="rounded-lg border border-amber-200/90 bg-amber-50/60 p-4 dark:border-amber-900/60 dark:bg-amber-950/25 lg:col-span-2 xl:col-span-2">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200/90">
                    Delete by month (UTC)
                  </p>
                  <p className="mb-3 text-xs text-neutral-600 dark:text-neutral-400">
                    Removes every log row whose time falls in that calendar month (server UTC).
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1 sm:max-w-[240px]">
                      <label
                        className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
                        htmlFor="log-clear-month"
                      >
                        Month
                      </label>
                      <input
                        id="log-clear-month"
                        type="month"
                        className="form-input h-10 w-full"
                        value={monthClearValue}
                        onChange={(e) => setMonthClearValue(e.target.value)}
                        disabled={logDeleting}
                      />
                    </div>
                    <button
                      type="button"
                      className="inline-flex h-10 shrink-0 items-center justify-center rounded-md border border-red-400 bg-red-100 px-4 text-sm font-medium text-red-950 hover:bg-red-200 disabled:opacity-50 dark:border-red-800 dark:bg-red-950/50 dark:text-red-100 dark:hover:bg-red-950/80 sm:self-end"
                      disabled={logDeleting}
                      onClick={onClearLogsMonth}
                    >
                      Delete all in month
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  Selected rows
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <button
                    type="button"
                    className="btn-secondary inline-flex h-10 w-full items-center justify-center text-sm sm:w-auto sm:min-w-[10rem]"
                    disabled={logLoading || logIdsOnPage.size === 0}
                    onClick={() => {
                      if (allLogsOnPageSelected) clearLogSelection();
                      else selectAllLogsOnPage();
                    }}
                  >
                    {allLogsOnPageSelected ? "Clear page selection" : "Select all on page"}
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-10 w-full items-center justify-center rounded-md border border-red-400 bg-red-100 px-4 text-sm font-medium text-red-950 hover:bg-red-200 disabled:opacity-50 dark:border-red-800 dark:bg-red-950/50 dark:text-red-100 dark:hover:bg-red-950/80 sm:w-auto"
                    disabled={logDeleting || logSelectedIds.size === 0}
                    onClick={onDeleteSelectedLogs}
                  >
                    Delete selected ({logSelectedIds.size})
                  </button>
                </div>
              </div>

              {logLoading ? (
                <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
              ) : (
                <>
                  <div className="w-full min-w-0 overflow-x-auto">
                    <Table
                      columns={logColumns}
                      rows={logs.items ?? []}
                      emptyText="No log entries"
                    />
                  </div>
                  <PaginationBar
                    page={logPage}
                    pages={logs.pages ?? 1}
                    total={logs.total ?? 0}
                    limit={logLimit}
                    disabled={logLoading}
                    onPageChange={setLogPage}
                  />
                </>
              )}
            </div>
          ) : (
            <div className="w-full space-y-5">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Outbound messages logged globally (transactional and follow-ups). Select rows to
                remove from this history.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  className="btn-secondary inline-flex h-10 w-full items-center justify-center text-sm sm:w-auto sm:min-w-[10rem]"
                  disabled={mailLoading || mailIdsOnPage.size === 0}
                  onClick={() => {
                    if (allMailOnPageSelected) clearMailSelection();
                    else selectAllMailOnPage();
                  }}
                >
                  {allMailOnPageSelected ? "Clear page selection" : "Select all on page"}
                </button>
                <button
                  type="button"
                  className="btn-secondary inline-flex h-10 w-full items-center justify-center text-sm sm:w-auto"
                  disabled={mailDeleting || mailSelectedIds.size === 0}
                  onClick={onDeleteSelectedMail}
                >
                  Delete selected ({mailSelectedIds.size})
                </button>
              </div>
              {mailLoading ? (
                <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
              ) : (
                <>
                  <div className="w-full min-w-0 overflow-x-auto">
                    <Table
                      columns={mailColumns}
                      rows={mails.items ?? []}
                      emptyText="No rows"
                    />
                  </div>
                  <PaginationBar
                    page={mailPage}
                    pages={mails.pages ?? 1}
                    total={mails.total ?? 0}
                    limit={mailLimit}
                    disabled={mailLoading}
                    onPageChange={setMailPage}
                  />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
