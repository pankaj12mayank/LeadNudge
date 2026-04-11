import { useEffect, useState } from "react";
import { toast } from "sonner";
import Card from "../../components/Card";
import Table from "../../components/Table";
import PaginationBar from "../../components/PaginationBar";
import * as adminService from "../../services/adminService";

function formatIso(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export default function AdminLogs() {
  const [logPage, setLogPage] = useState(1);
  const [logType, setLogType] = useState("all");
  const logLimit = 25;
  const [logs, setLogs] = useState({ items: [], total: 0, pages: 1 });
  const [logLoading, setLogLoading] = useState(true);

  const [mailPage, setMailPage] = useState(1);
  const mailLimit = 25;
  const [mails, setMails] = useState({ items: [], total: 0, pages: 1 });
  const [mailLoading, setMailLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
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
  }, [logPage, logType, logLimit]);

  useEffect(() => {
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
          setSelectedIds(new Set());
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
  }, [mailPage, mailLimit]);

  async function onDeleteSelected() {
    const ids = [...selectedIds];
    if (!ids.length) {
      toast.warning("Select at least one row.");
      return;
    }
    if (!confirm(`Delete ${ids.length} sent-email log row(s)?`)) return;
    setDeleting(true);
    try {
      await adminService.deleteAdminSentEmails(ids);
      toast.success("Deleted.");
      const data = await adminService.listAdminSentEmails({
        page: mailPage,
        limit: mailLimit,
      });
      setMails(data);
      setSelectedIds(new Set());
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDeleting(false);
    }
  }

  const logColumns = [
    { key: "id", label: "ID" },
    { key: "type", label: "Type" },
    {
      key: "message",
      label: "Message",
      render: (r) => (
        <pre className="max-h-32 max-w-xl overflow-auto whitespace-pre-wrap text-xs text-neutral-700 dark:text-neutral-300">
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
          checked={selectedIds.has(r.id)}
          onChange={(e) => {
            const next = new Set(selectedIds);
            if (e.target.checked) next.add(r.id);
            else next.delete(r.id);
            setSelectedIds(next);
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
        <span className="line-clamp-2 max-w-xs text-xs text-neutral-600 dark:text-neutral-400">
          {r.body}
        </span>
      ),
    },
  ];

  return (
    <div className="w-full space-y-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="w-full border-b border-neutral-200 pb-6 dark:border-neutral-800">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Diagnostics
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          System logs &amp; sent mail
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          AI failures, email errors, and a global log of outbound messages (transactional and
          follow-ups).
        </p>
      </section>

      <Card title="System logs">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="form-label mb-0">Type</label>
          <select
            className="form-select max-w-xs"
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
        {logLoading ? (
          <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
        ) : (
          <>
            <Table columns={logColumns} rows={logs.items ?? []} emptyText="No log entries" />
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
      </Card>

      <Card title="Sent emails (global)">
        <div className="mb-4">
          <button
            type="button"
            className="btn-secondary text-sm"
            disabled={deleting || selectedIds.size === 0}
            onClick={onDeleteSelected}
          >
            Delete selected
          </button>
        </div>
        {mailLoading ? (
          <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
        ) : (
          <>
            <Table columns={mailColumns} rows={mails.items ?? []} emptyText="No rows" />
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
      </Card>
    </div>
  );
}
