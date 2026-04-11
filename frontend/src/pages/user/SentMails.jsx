import { useEffect, useState } from "react";
import { toast } from "sonner";
import Card from "../../components/Card";
import Table from "../../components/Table";
import PaginationBar from "../../components/PaginationBar";
import * as userService from "../../services/userService";
import { formatScheduleDisplay } from "../../utils/formatSchedule";

export default function SentMails() {
  const [page, setPage] = useState(1);
  const limit = 25;
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    let c = false;
    (async () => {
      setLoading(true);
      setListLoading(true);
      try {
        const data = await userService.listOutboundMails({
          page,
          limit,
          q: q || undefined,
        });
        if (!c) {
          setRows(data.items ?? []);
          setTotal(data.total ?? 0);
          setPages(data.pages ?? 1);
        }
      } catch (e) {
        if (!c) toast.error(e.message);
      } finally {
        if (!c) {
          setLoading(false);
          setListLoading(false);
        }
      }
    })();
    return () => {
      c = true;
    };
  }, [page, limit, q]);

  const columns = [
    { key: "lead_name", label: "Lead" },
    {
      key: "lead_id",
      label: "Lead ID",
      render: (r) =>
        r.lead_id != null ? (
          <span className="font-mono text-sm text-neutral-700 dark:text-neutral-300">
            #{r.lead_id}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "to_email",
      label: "To (lead email)",
      render: (r) => (
        <span className="text-sm text-neutral-800 dark:text-neutral-200">{r.to_email}</span>
      ),
    },
    {
      key: "subject",
      label: "Subject",
      render: (r) => (
        <span className="max-w-xs text-neutral-800 dark:text-neutral-200">{r.subject}</span>
      ),
    },
    {
      key: "sent_at",
      label: "Sent",
      render: (r) => formatScheduleDisplay(r.sent_at),
    },
    {
      key: "body_preview",
      label: "Preview",
      render: (r) => (
        <span className="line-clamp-3 max-w-md text-sm text-neutral-600 dark:text-neutral-400">
          {r.body_preview || "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="w-full space-y-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="w-full border-b border-neutral-200 pb-6 dark:border-neutral-800">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Delivery log
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Sent follow-up mail
        </h1>
        <p className="mt-2 w-full text-sm text-neutral-600 dark:text-neutral-400">
          Each row is an email the system sent through your workspace SMTP to the lead&apos;s email
          (the &quot;To&quot; column) when a scheduled follow-up ran. If SMTP is not configured,
          drafts stay on the Follow-ups page for you to copy manually.
        </p>
      </section>

      <Card title="Outbound history">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label className="form-label">Filter</label>
            <input
              className="form-input w-full"
              placeholder="Lead name, email, or subject"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  setPage(1);
                  setQ(qInput.trim());
                }
              }}
            />
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <button
              type="button"
              className="btn-primary w-full sm:w-auto"
              onClick={() => {
                setPage(1);
                setQ(qInput.trim());
              }}
            >
              Search
            </button>
            <button
              type="button"
              className="btn-secondary w-full sm:w-auto"
              onClick={() => {
                setQInput("");
                setQ("");
                setPage(1);
              }}
            >
              Clear
            </button>
          </div>
        </div>
        {loading ? (
          <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
        ) : (
          <>
            <Table columns={columns} rows={rows} emptyText="No sent mail yet" />
            <PaginationBar
              page={page}
              pages={pages}
              total={total}
              limit={limit}
              disabled={listLoading}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>
    </div>
  );
}
