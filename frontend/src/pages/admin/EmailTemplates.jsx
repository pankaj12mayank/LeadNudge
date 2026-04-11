import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import Card from "../../components/Card";
import * as adminService from "../../services/adminService";

const PLACEHOLDER_HELP =
  "Placeholders: {{name}}, {{email}}, {{password}}, {{user_name}}, {{project_name}}.";

export default function EmailTemplates() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await adminService.listEmailTemplates();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const current = useMemo(
    () => rows.find((r) => r.name === selected),
    [rows, selected],
  );

  useEffect(() => {
    if (!rows.length) {
      setSelected("");
      return;
    }
    setSelected((prev) =>
      prev && rows.some((r) => r.name === prev)
        ? prev
        : rows[0].name,
    );
  }, [rows]);

  useEffect(() => {
    if (!current) {
      setSubject("");
      setBody("");
      return;
    }
    setSubject(current.subject || "");
    setBody(current.body || "");
  }, [current]);

  async function onSave(e) {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      await adminService.putEmailTemplate(selected, { subject, body });
      toast.success("Template saved");
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full max-w-none space-y-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="border-b border-neutral-200 pb-6 dark:border-neutral-800">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Automation
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Email templates
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-neutral-600 dark:text-neutral-400">
          Subject and HTML body for system emails (welcome, password set by admin, plan / usage
          notices). Uses SMTP from Account &amp; branding. {PLACEHOLDER_HELP}
        </p>
      </section>

      <Card title="Edit template">
        {loading ? (
          <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
        ) : (
          <form onSubmit={onSave} className="space-y-4">
            <div>
              <label className="form-label" htmlFor="tpl-name">
                Template
              </label>
              <select
                id="tpl-name"
                className="form-select w-full max-w-xl"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                disabled={saving}
              >
                {rows.map((r) => (
                  <option key={r.name} value={r.name}>
                    {r.name.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label" htmlFor="tpl-subject">
                Subject
              </label>
              <input
                id="tpl-subject"
                className="form-input w-full"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={saving}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="tpl-body">
                Body (HTML)
              </label>
              <textarea
                id="tpl-body"
                className="form-input min-h-[220px] w-full font-mono text-sm"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={saving}
                spellCheck={false}
              />
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {PLACEHOLDER_HELP}
              </p>
            </div>
            <button type="submit" className="btn-primary" disabled={saving || !selected}>
              {saving ? "Saving…" : "Save template"}
            </button>
          </form>
        )}
      </Card>
    </div>
  );
}
