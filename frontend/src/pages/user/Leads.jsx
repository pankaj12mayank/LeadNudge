import { useEffect, useMemo, useState } from "react";
import PhoneInput, { parsePhoneNumber } from "react-phone-number-input";
import { toast } from "sonner";
import "react-phone-number-input/style.css";
import Card from "../../components/Card";
import Table from "../../components/Table";
import Badge from "../../components/Badge";
import PaginationBar from "../../components/PaginationBar";
import * as userService from "../../services/userService";
import { countryFlagEmoji } from "../../utils/countryFlag";

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "interested", label: "Interested" },
  { value: "not_interested", label: "Not interested" },
  { value: "closed", label: "Closed" },
];

const emptyForm = {
  name: "",
  email: "",
  status: "new",
  company: "",
  phoneE164: "",
  last_message: "",
  role_title: "",
  profile_link: "",
  agency_type: "",
  team_size_estimate: "",
  problem_seen: "",
  last_active_display: "",
  connection_sent_date: "",
  replied_y_n: "",
};

function trunc(s, n = 48) {
  const t = (s || "").trim();
  if (!t) return "—";
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

function phonePayload(phoneE164) {
  const trimmed = phoneE164?.trim() || "";
  if (!trimmed) {
    return { phone_number: null, country_code: null };
  }
  const p = parsePhoneNumber(trimmed);
  return {
    phone_number: trimmed,
    country_code: p?.country ?? null,
  };
}

export default function Leads() {
  const [page, setPage] = useState(1);
  const limit = 20;
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);

  const idsOnPage = useMemo(
    () => new Set(rows.map((r) => r.id)),
    [rows],
  );

  const allOnPageSelected =
    idsOnPage.size > 0 && [...idsOnPage].every((id) => selectedIds.has(id));

  function applyListPayload(data) {
    setRows(data.items ?? []);
    setTotal(data.total ?? 0);
    setPages(data.pages ?? 1);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setListLoading(true);
      try {
        const data = await userService.listLeads(undefined, {
          page,
          limit,
          q: searchQ || undefined,
        });
        if (!cancelled) applyListPayload(data);
      } catch (e) {
        if (!cancelled) toast.error(e.message);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setListLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, limit, searchQ]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, searchQ]);

  async function refreshList() {
    const data = await userService.listLeads(undefined, {
      page,
      limit,
      q: searchQ || undefined,
    });
    applyListPayload(data);
  }

  async function onCreate(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.warning("Name and email are required");
      return;
    }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
    if (!emailOk) {
      toast.warning("Enter a valid email address");
      return;
    }
    setSaving(true);
    try {
      const ph = phonePayload(form.phoneE164);
      await userService.createLead({
        name: form.name.trim(),
        email: form.email.trim(),
        status: form.status || "new",
        company: form.company.trim() || null,
        phone_number: ph.phone_number,
        country_code: ph.country_code,
        last_message: form.last_message.trim() || null,
        role_title: form.role_title.trim() || null,
        profile_link: form.profile_link.trim() || null,
        agency_type: form.agency_type.trim() || null,
        team_size_estimate: form.team_size_estimate.trim() || null,
        problem_seen: form.problem_seen.trim() || null,
        last_active_display: form.last_active_display.trim() || null,
        connection_sent_date: form.connection_sent_date.trim() || null,
        replied_y_n: form.replied_y_n.trim() || null,
      });
      setForm(emptyForm);
      setAddOpen(false);
      toast.success("Lead added successfully");
      await refreshList();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function onUpdate(e) {
    e.preventDefault();
    if (!editing) return;
    if (!editing.name?.trim() || !editing.email?.trim()) {
      toast.warning("Name and email are required");
      return;
    }
    setSaving(true);
    try {
      const ph = phonePayload(editing.phoneE164);
      await userService.updateLead(editing.id, {
        name: editing.name.trim(),
        email: editing.email.trim(),
        status: editing.status || undefined,
        company: (editing.company || "").trim(),
        phone_number: ph.phone_number,
        country_code: ph.country_code,
        last_message: editing.last_message?.trim() || null,
        role_title: (editing.role_title || "").trim() || null,
        profile_link: (editing.profile_link || "").trim() || null,
        agency_type: (editing.agency_type || "").trim() || null,
        team_size_estimate: (editing.team_size_estimate || "").trim() || null,
        problem_seen: (editing.problem_seen || "").trim() || null,
        last_active_display: (editing.last_active_display || "").trim() || null,
        connection_sent_date: (editing.connection_sent_date || "").trim() || null,
        replied_y_n: (editing.replied_y_n || "").trim() || null,
      });
      setEditing(null);
      toast.success("Lead updated");
      await refreshList();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id) {
    if (!confirm("Delete this lead?")) return;
    try {
      await userService.deleteLead(id);
      toast.success("Lead deleted");
      await refreshList();
      setSelectedIds(new Set());
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function onDeleteSelected() {
    const ids = [...selectedIds];
    if (!ids.length) {
      toast.warning("Select at least one lead.");
      return;
    }
    if (
      !confirm(
        `Delete ${ids.length} lead(s)? Their follow-ups and message history will be removed too.`,
      )
    )
      return;
    setBatchDeleting(true);
    try {
      const { deleted } = await userService.deleteLeadsBatch(ids);
      toast.success(
        deleted
          ? `Deleted ${deleted} lead(s).`
          : "No matching leads to delete.",
      );
      setSelectedIds(new Set());
      await refreshList();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBatchDeleting(false);
    }
  }

  async function onImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.warning("Please choose a .csv file");
      return;
    }
    setImporting(true);
    setImportSummary(null);
    try {
      const r = await userService.importLeadsCsv(file);
      setImportSummary({
        total_rows: r.total_rows ?? 0,
        inserted: r.inserted ?? 0,
        skipped: r.skipped ?? 0,
        errors: r.errors ?? [],
      });
      const msg = `Imported ${r.inserted} lead(s)${
        r.skipped ? `, skipped ${r.skipped}` : ""
      }`;
      toast.success(msg);
      if (r.errors?.length) {
        toast.warning(r.errors.slice(0, 3).join(" · "));
      }
      await refreshList();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setImporting(false);
    }
  }

  async function onDownloadSample() {
    try {
      await userService.downloadLeadsCsvSample();
      toast.success("Sample CSV downloaded");
    } catch (e) {
      toast.error(e.message);
    }
  }

  const columns = useMemo(
    () => [
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
            aria-label={`Select lead ${r.id}`}
          />
        ),
      },
      { key: "id", label: "ID" },
      { key: "name", label: "Name" },
      {
        key: "company",
        label: "Company",
        render: (r) => (
          <span className="max-w-[8rem] truncate text-sm text-neutral-600 dark:text-neutral-400">
            {r.company || "—"}
          </span>
        ),
      },
      {
        key: "role_title",
        label: "Role",
        render: (r) => (
          <span className="max-w-[7rem] truncate text-sm">{r.role_title || "—"}</span>
        ),
      },
      {
        key: "profile_link",
        label: "Profile Link",
        render: (r) => {
          const u = (r.profile_link || "").trim();
          if (!u) return "—";
          if (/^https?:\/\//i.test(u)) {
            return (
              <a
                href={u}
                target="_blank"
                rel="noopener noreferrer"
                className="max-w-[9rem] truncate text-sm text-blue-600 underline dark:text-blue-400"
              >
                {trunc(u, 28)}
              </a>
            );
          }
          return <span className="max-w-[9rem] truncate text-sm">{trunc(u, 28)}</span>;
        },
      },
      {
        key: "agency_type",
        label: "Agency Type",
        render: (r) => (
          <span className="max-w-[7rem] truncate text-sm">{r.agency_type || "—"}</span>
        ),
      },
      {
        key: "team_size_estimate",
        label: "Team Size",
        render: (r) => (
          <span className="max-w-[6rem] truncate text-sm">{r.team_size_estimate || "—"}</span>
        ),
      },
      {
        key: "problem_seen",
        label: "Problem Seen",
        render: (r) => (
          <span className="line-clamp-2 max-w-[10rem] text-xs text-neutral-600 dark:text-neutral-400">
            {r.problem_seen || "—"}
          </span>
        ),
      },
      {
        key: "last_active_display",
        label: "Last Active",
        render: (r) => (
          <span className="max-w-[7rem] truncate text-xs">{r.last_active_display || "—"}</span>
        ),
      },
      {
        key: "connection_sent_date",
        label: "Connection Sent",
        render: (r) => (
          <span className="max-w-[7rem] truncate text-xs">{r.connection_sent_date || "—"}</span>
        ),
      },
      {
        key: "replied_y_n",
        label: "Replied",
        render: (r) => (
          <span className="text-sm font-medium tabular-nums">{r.replied_y_n || "—"}</span>
        ),
      },
      {
        key: "status",
        label: "Status",
        render: (r) => <Badge variant="muted">{r.status}</Badge>,
      },
      { key: "email", label: "Email" },
      {
        key: "phone_number",
        label: "Phone",
        render: (r) => {
          const flag = countryFlagEmoji(r.country_code);
          return (
            <span className="inline-flex max-w-[9rem] items-center gap-1 text-xs text-neutral-600 dark:text-neutral-400">
              {flag ? (
                <span className="text-base leading-none" title={r.country_code || ""}>
                  {flag}
                </span>
              ) : null}
              <span className="truncate">
                {r.country_code ? `${r.country_code} ` : ""}
                {r.phone_number || "—"}
              </span>
            </span>
          );
        },
      },
      {
        key: "temperature_tag",
        label: "Heat",
        render: (r) => {
          const t = (r.temperature_tag || "").toLowerCase();
          if (!t) return <span className="text-neutral-400">—</span>;
          const v =
            t === "hot" ? "hot" : t === "warm" ? "warm" : t === "cold" ? "cold" : "muted";
          return (
            <Badge variant={v}>
              {t === "hot" ? "HOT" : t === "warm" ? "WARM" : t === "cold" ? "COLD" : t}
            </Badge>
          );
        },
      },
      {
        key: "last_message",
        label: "Last message",
        render: (r) => (
          <span className="line-clamp-2 max-w-[8rem] text-xs text-neutral-600 dark:text-neutral-400">
            {r.last_message || "—"}
          </span>
        ),
      },
      {
        key: "actions",
        label: "",
        render: (r) => (
          <div className="flex gap-2">
            <button
              type="button"
              className="text-sm font-medium text-neutral-900 underline decoration-neutral-400 underline-offset-2 dark:text-neutral-100"
              onClick={() =>
                setEditing({
                  id: r.id,
                  name: r.name,
                  email: r.email,
                  status: r.status,
                  company: r.company || "",
                  phoneE164: r.phone_number || "",
                  last_message: r.last_message || "",
                  role_title: r.role_title || "",
                  profile_link: r.profile_link || "",
                  agency_type: r.agency_type || "",
                  team_size_estimate: r.team_size_estimate || "",
                  problem_seen: r.problem_seen || "",
                  last_active_display: r.last_active_display || "",
                  connection_sent_date: r.connection_sent_date || "",
                  replied_y_n: r.replied_y_n || "",
                })
              }
            >
              Edit
            </button>
            <button
              type="button"
              className="text-sm font-medium text-neutral-600 underline decoration-neutral-400 underline-offset-2 dark:text-neutral-400"
              onClick={() => onDelete(r.id)}
            >
              Delete
            </button>
          </div>
        ),
      },
    ],
    [selectedIds],
  );

  return (
    <div className="w-full space-y-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="w-full border-b border-neutral-200 pb-6 dark:border-neutral-800">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Pipeline
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
              Contact list &amp; stages
            </h1>
            <p className="mt-2 w-full text-sm text-neutral-600 dark:text-neutral-400">
              Table columns follow your pipeline headers (Name, Company, Role, profile link, agency
              type, etc.). Import the sample CSV or add leads manually — legacy phone+email CSV still
              works.
            </p>
          </div>
          <button
            type="button"
            className="btn-primary w-full shrink-0 sm:w-auto"
            onClick={() => setAddOpen(true)}
          >
            Add lead
          </button>
        </div>
      </section>

      <Card title="Import CSV">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex">
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              disabled={importing || saving}
              onChange={onImportFile}
            />
            <span className="btn-primary cursor-pointer">
              {importing ? "Uploading…" : "Import CSV"}
            </span>
          </label>
          <button
            type="button"
            className="btn-secondary"
            disabled={importing}
            onClick={onDownloadSample}
          >
            Download Sample CSV
          </button>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            <strong>Default format:</strong> Name, Company, Role, Profile Link, Agency Type (SEO /
            Ads / Creative), Team Size (estimate), Problem Seen, Last Active, Connection Sent
            (Date), Replied (Y/N), Status — <strong>email optional</strong> (auto placeholder if
            blank). <strong>Legacy:</strong> name, email, phone, country_code (+ optional company,
            status, notes).
          </p>
        </div>
      </Card>

      {importSummary ? (
        <Card title="Last import summary">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900/60">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Total rows
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                {importSummary.total_rows}
              </p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/40">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
                सफल (success)
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-900 dark:text-emerald-100">
                {importSummary.inserted}
              </p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/40">
              <p className="text-xs font-medium uppercase tracking-wide text-red-800 dark:text-red-200">
                Failed / skipped
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-red-900 dark:text-red-100">
                {importSummary.skipped}
              </p>
            </div>
          </div>
          {importSummary.errors?.length ? (
            <details className="mt-4 rounded-md border border-neutral-200 dark:border-neutral-700">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200">
                Error report ({importSummary.errors.length}
                {importSummary.errors.length >= 50 ? "+" : ""})
              </summary>
              <ul className="max-h-48 list-inside list-disc overflow-y-auto border-t border-neutral-200 px-3 py-2 text-xs text-red-800 dark:border-neutral-700 dark:text-red-300">
                {importSummary.errors.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </details>
          ) : null}
          <button
            type="button"
            className="btn-secondary mt-4"
            onClick={() => setImportSummary(null)}
          >
            Dismiss summary
          </button>
        </Card>
      ) : null}

      {addOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-lead-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close"
            onClick={() => !saving && setAddOpen(false)}
          />
          <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-neutral-200 bg-white p-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-900 sm:p-6">
            <h2
              id="add-lead-title"
              className="text-lg font-semibold text-neutral-900 dark:text-neutral-100"
            >
              Add lead
            </h2>
            <form
              onSubmit={onCreate}
              className="mt-4 grid gap-4 sm:grid-cols-2"
            >
              <div>
                <label className="form-label">Name</label>
                <input
                  className="form-input"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  disabled={saving}
                  required
                />
              </div>
              <div>
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  disabled={saving}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="form-label">Phone</label>
                <div className="phone-input-wrap rounded-md border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-600 dark:bg-neutral-950">
                  <PhoneInput
                    international
                    defaultCountry="US"
                    value={form.phoneE164 || undefined}
                    onChange={(v) =>
                      setForm((f) => ({ ...f, phoneE164: v || "" }))
                    }
                    disabled={saving}
                    className="phone-input"
                  />
                </div>
              </div>
              <div>
                <label className="form-label">Status</label>
                <select
                  className="form-input"
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.value }))
                  }
                  disabled={saving}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Company (optional)</label>
                <input
                  className="form-input"
                  value={form.company}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, company: e.target.value }))
                  }
                  disabled={saving}
                  placeholder="e.g. Acme Pvt Ltd"
                />
              </div>
              <div className="sm:col-span-2 border-t border-neutral-200 pt-4 dark:border-neutral-700">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  Pipeline fields (optional — same as CSV headers)
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="form-label">Role</label>
                    <input
                      className="form-input"
                      value={form.role_title}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, role_title: e.target.value }))
                      }
                      disabled={saving}
                      placeholder="e.g. Founder"
                    />
                  </div>
                  <div>
                    <label className="form-label">Agency type (SEO / Ads / Creative)</label>
                    <input
                      className="form-input"
                      value={form.agency_type}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, agency_type: e.target.value }))
                      }
                      disabled={saving}
                      placeholder="e.g. SEO"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="form-label">Profile link</label>
                    <input
                      className="form-input"
                      value={form.profile_link}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, profile_link: e.target.value }))
                      }
                      disabled={saving}
                      placeholder="https://linkedin.com/in/…"
                    />
                  </div>
                  <div>
                    <label className="form-label">Team size (estimate)</label>
                    <input
                      className="form-input"
                      value={form.team_size_estimate}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, team_size_estimate: e.target.value }))
                      }
                      disabled={saving}
                      placeholder="e.g. 10–20"
                    />
                  </div>
                  <div>
                    <label className="form-label">Replied (Y/N)</label>
                    <input
                      className="form-input"
                      value={form.replied_y_n}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, replied_y_n: e.target.value }))
                      }
                      disabled={saving}
                      placeholder="Y or N"
                      maxLength={8}
                    />
                  </div>
                  <div>
                    <label className="form-label">Last active</label>
                    <input
                      className="form-input"
                      value={form.last_active_display}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, last_active_display: e.target.value }))
                      }
                      disabled={saving}
                      placeholder="e.g. 2025-01-12"
                    />
                  </div>
                  <div>
                    <label className="form-label">Connection sent (date)</label>
                    <input
                      className="form-input"
                      value={form.connection_sent_date}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, connection_sent_date: e.target.value }))
                      }
                      disabled={saving}
                      placeholder="e.g. 2025-01-08"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="form-label">Problem seen</label>
                    <textarea
                      className="form-input min-h-[72px] resize-y"
                      rows={2}
                      value={form.problem_seen}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, problem_seen: e.target.value }))
                      }
                      disabled={saving}
                      placeholder="What they need or objected to"
                    />
                  </div>
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="form-label">Last message / note (optional)</label>
                <textarea
                  className="form-input min-h-[88px] resize-y"
                  rows={3}
                  value={form.last_message}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, last_message: e.target.value }))
                  }
                  disabled={saving}
                  placeholder="e.g. They asked for pricing after the demo — used as AI context"
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row">
                <button type="submit" disabled={saving} className="btn-primary w-full sm:w-auto">
                  Save lead
                </button>
                <button
                  type="button"
                  className="btn-secondary w-full sm:w-auto"
                  disabled={saving}
                  onClick={() => setAddOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-lead-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close"
            onClick={() => !saving && setEditing(null)}
          />
          <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-neutral-200 bg-white p-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-900 sm:p-6">
            <h2
              id="edit-lead-title"
              className="text-lg font-semibold text-neutral-900 dark:text-neutral-100"
            >
              Edit lead
            </h2>
            <form onSubmit={onUpdate} className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="form-label">Name</label>
                <input
                  className="form-input"
                  value={editing.name}
                  onChange={(e) =>
                    setEditing((x) => ({ ...x, name: e.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={editing.email}
                  onChange={(e) =>
                    setEditing((x) => ({ ...x, email: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="form-label">Phone</label>
                <div className="phone-input-wrap rounded-md border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-600 dark:bg-neutral-950">
                  <PhoneInput
                    international
                    defaultCountry="US"
                    value={editing.phoneE164 || undefined}
                    onChange={(v) =>
                      setEditing((x) => ({ ...x, phoneE164: v || "" }))
                    }
                    disabled={saving}
                  />
                </div>
              </div>
              <div>
                <label className="form-label">Status</label>
                <select
                  className="form-input"
                  value={editing.status || "new"}
                  onChange={(e) =>
                    setEditing((x) => ({ ...x, status: e.target.value }))
                  }
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Company (optional)</label>
                <input
                  className="form-input"
                  value={editing.company || ""}
                  onChange={(e) =>
                    setEditing((x) => ({ ...x, company: e.target.value }))
                  }
                  placeholder="e.g. Acme Pvt Ltd"
                />
              </div>
              <div className="sm:col-span-2 border-t border-neutral-200 pt-4 dark:border-neutral-700">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  Pipeline fields (optional)
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="form-label">Role</label>
                    <input
                      className="form-input"
                      value={editing.role_title || ""}
                      onChange={(e) =>
                        setEditing((x) => ({ ...x, role_title: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="form-label">Agency type</label>
                    <input
                      className="form-input"
                      value={editing.agency_type || ""}
                      onChange={(e) =>
                        setEditing((x) => ({ ...x, agency_type: e.target.value }))
                      }
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="form-label">Profile link</label>
                    <input
                      className="form-input"
                      value={editing.profile_link || ""}
                      onChange={(e) =>
                        setEditing((x) => ({ ...x, profile_link: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="form-label">Team size (estimate)</label>
                    <input
                      className="form-input"
                      value={editing.team_size_estimate || ""}
                      onChange={(e) =>
                        setEditing((x) => ({ ...x, team_size_estimate: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="form-label">Replied (Y/N)</label>
                    <input
                      className="form-input"
                      value={editing.replied_y_n || ""}
                      onChange={(e) =>
                        setEditing((x) => ({ ...x, replied_y_n: e.target.value }))
                      }
                      maxLength={8}
                    />
                  </div>
                  <div>
                    <label className="form-label">Last active</label>
                    <input
                      className="form-input"
                      value={editing.last_active_display || ""}
                      onChange={(e) =>
                        setEditing((x) => ({ ...x, last_active_display: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="form-label">Connection sent (date)</label>
                    <input
                      className="form-input"
                      value={editing.connection_sent_date || ""}
                      onChange={(e) =>
                        setEditing((x) => ({ ...x, connection_sent_date: e.target.value }))
                      }
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="form-label">Problem seen</label>
                    <textarea
                      className="form-input min-h-[72px] resize-y"
                      rows={2}
                      value={editing.problem_seen || ""}
                      onChange={(e) =>
                        setEditing((x) => ({ ...x, problem_seen: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="form-label">Last message / note (optional)</label>
                <textarea
                  className="form-input min-h-[88px] resize-y"
                  rows={3}
                  value={editing.last_message || ""}
                  onChange={(e) =>
                    setEditing((x) => ({ ...x, last_message: e.target.value }))
                  }
                  placeholder="Context for AI when scheduling follow-ups"
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row">
                <button type="submit" disabled={saving} className="btn-primary w-full sm:w-auto">
                  Save
                </button>
                <button
                  type="button"
                  className="btn-secondary w-full sm:w-auto"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Card title="Your leads">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label className="form-label">Search</label>
            <input
              className="form-input w-full"
              placeholder="Name or email"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  setPage(1);
                  setSearchQ(searchInput.trim());
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
                setSearchQ(searchInput.trim());
              }}
            >
              Search
            </button>
            <button
              type="button"
              className="btn-secondary w-full sm:w-auto"
              onClick={() => {
                setSearchInput("");
                setSearchQ("");
                setPage(1);
              }}
            >
              Clear
            </button>
          </div>
        </div>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            className="btn-secondary inline-flex h-10 w-full items-center justify-center text-sm sm:w-auto sm:min-w-[11rem]"
            disabled={loading || listLoading || idsOnPage.size === 0}
            onClick={() => {
              if (allOnPageSelected) setSelectedIds(new Set());
              else setSelectedIds(new Set(idsOnPage));
            }}
          >
            {allOnPageSelected ? "Clear page selection" : "Select all on page"}
          </button>
          <button
            type="button"
            className="inline-flex h-10 w-full items-center justify-center rounded-md border border-red-400 bg-red-100 px-4 text-sm font-medium text-red-950 hover:bg-red-200 disabled:opacity-50 dark:border-red-800 dark:bg-red-950/50 dark:text-red-100 dark:hover:bg-red-950/80 sm:w-auto"
            disabled={batchDeleting || selectedIds.size === 0}
            onClick={onDeleteSelected}
          >
            Delete selected ({selectedIds.size})
          </button>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 sm:ml-1">
            Up to 500 per action. Deletes follow-ups and messages for those leads.
          </p>
        </div>
        {loading ? (
          <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table columns={columns} rows={rows} emptyText="No leads yet" />
            </div>
            <PaginationBar
              page={page}
              pages={pages}
              total={total}
              limit={limit}
              disabled={listLoading}
              onPageChange={(p) => setPage(p)}
            />
          </>
        )}
      </Card>
    </div>
  );
}
