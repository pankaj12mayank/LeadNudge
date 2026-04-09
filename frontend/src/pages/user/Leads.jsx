import { useEffect, useState } from "react";
import PhoneInput, { parsePhoneNumber } from "react-phone-number-input";
import { toast } from "sonner";
import "react-phone-number-input/style.css";
import Card from "../../components/Card";
import Table from "../../components/Table";
import Badge from "../../components/Badge";
import PaginationBar from "../../components/PaginationBar";
import * as userService from "../../services/userService";

const emptyForm = {
  name: "",
  email: "",
  status: "new",
  tag: "",
  phoneE164: "",
};

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
        const data = await userService.listLeads(undefined, { page, limit });
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
  }, [page, limit]);

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
        tag: form.tag.trim() || null,
        phone_number: ph.phone_number,
        country_code: ph.country_code,
      });
      setForm(emptyForm);
      toast.success("Lead added successfully");
      const data = await userService.listLeads(undefined, { page, limit });
      applyListPayload(data);
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
        tag: editing.tag?.trim() || null,
        phone_number: ph.phone_number,
        country_code: ph.country_code,
      });
      setEditing(null);
      toast.success("Lead updated");
      const data = await userService.listLeads(undefined, { page, limit });
      applyListPayload(data);
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
      const data = await userService.listLeads(undefined, { page, limit });
      applyListPayload(data);
    } catch (err) {
      toast.error(err.message);
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
    try {
      const r = await userService.importLeadsCsv(file);
      const msg = `Imported ${r.inserted} lead(s)${
        r.skipped ? `, skipped ${r.skipped}` : ""
      }`;
      toast.success(msg);
      if (r.errors?.length) {
        toast.warning(r.errors.slice(0, 3).join(" · "));
      }
      const data = await userService.listLeads(undefined, { page, limit });
      applyListPayload(data);
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

  const columns = [
    { key: "id", label: "ID" },
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    {
      key: "phone_number",
      label: "Phone",
      render: (r) => (
        <span className="text-neutral-600 dark:text-neutral-400">
          {r.country_code ? `${r.country_code} ` : ""}
          {r.phone_number || "—"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => <Badge variant="muted">{r.status}</Badge>,
    },
    { key: "tag", label: "Tag" },
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
                tag: r.tag || "",
                phoneE164: r.phone_number || "",
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
  ];

  return (
    <div className="space-y-8 p-4 lg:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Leads
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Manage leads in your workspace. Import a CSV or add rows manually.
        </p>
      </div>

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
            Download sample CSV
          </button>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Columns: name, email, phone, country_code (e.g. US).
          </p>
        </div>
      </Card>

      <Card title="Add lead">
        <form
          onSubmit={onCreate}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <div>
            <label className="form-label">Name</label>
            <input
              className="form-input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
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
          <div className="sm:col-span-2 lg:col-span-3">
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
            <input
              className="form-input"
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({ ...f, status: e.target.value }))
              }
              disabled={saving}
            />
          </div>
          <div>
            <label className="form-label">Tag</label>
            <input
              className="form-input"
              value={form.tag}
              onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))}
              disabled={saving}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <button type="submit" disabled={saving} className="btn-primary">
              Add lead
            </button>
          </div>
        </form>
      </Card>

      {editing && (
        <Card title="Edit lead">
          <form onSubmit={onUpdate} className="grid gap-4 sm:grid-cols-2">
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
              <input
                className="form-input"
                value={editing.status}
                onChange={(e) =>
                  setEditing((x) => ({ ...x, status: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="form-label">Tag</label>
              <input
                className="form-input"
                value={editing.tag}
                onChange={(e) =>
                  setEditing((x) => ({ ...x, tag: e.target.value }))
                }
              />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" disabled={saving} className="btn-primary">
                Save
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      <Card title="Your leads">
        {loading ? (
          <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
        ) : (
          <>
            <Table columns={columns} rows={rows} emptyText="No leads yet" />
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
