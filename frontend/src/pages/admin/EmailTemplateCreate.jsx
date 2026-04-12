import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import Card from "../../components/Card";
import * as adminService from "../../services/adminService";

const PLACEHOLDER_HELP =
  "Placeholders: {{name}}, {{email}}, {{password}}, {{user_name}}, {{project_name}}.";

const DEFAULT_BODY = `<p>Hi {{name}},</p>
<p>Edit this HTML body. Use the placeholders above where needed.</p>
<p>— {{project_name}}</p>`;

export default function EmailTemplateCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselect = useMemo(
    () => (searchParams.get("trigger") || "").trim(),
    [searchParams],
  );

  const [triggers, setTriggers] = useState([]);
  const [triggerKey, setTriggerKey] = useState("");
  const [subject, setSubject] = useState("Notification");
  const [body, setBody] = useState(DEFAULT_BODY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let c = false;
    (async () => {
      setLoading(true);
      try {
        const data = await adminService.listEmailTemplateTriggers();
        if (c) return;
        const list = Array.isArray(data) ? data : [];
        setTriggers(list);
        const free = list.filter((t) => !t.has_template);
        const initial =
          preselect && free.some((t) => t.key === preselect)
            ? preselect
            : free[0]?.key || "";
        setTriggerKey(initial);
      } catch (e) {
        if (!c) toast.error(e.message);
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [preselect]);

  const availableTriggers = triggers.filter((t) => !t.has_template);

  async function onSubmit(e) {
    e.preventDefault();
    if (!triggerKey) {
      toast.warning("All triggers already have a template. Delete one first to create a new one.");
      return;
    }
    setSaving(true);
    try {
      await adminService.createEmailTemplate({
        trigger_key: triggerKey,
        subject: subject.trim(),
        body,
      });
      toast.success("Template created");
      navigate(`/admin/email-templates/${encodeURIComponent(triggerKey)}`, {
        replace: true,
      });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/admin/email-templates"
          className="text-sm font-medium text-neutral-600 underline decoration-neutral-400 underline-offset-2 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          ← All templates
        </Link>
      </div>

      <section className="border-b border-neutral-200 pb-4 dark:border-neutral-800">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Add email template
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Choose the <strong>trigger</strong> this message belongs to. Triggers that already have a
          template are hidden here — delete the existing template first if you need to replace it.{" "}
          {PLACEHOLDER_HELP}
        </p>
      </section>

      <Card title="New template">
        {loading ? (
          <p className="text-neutral-500 dark:text-neutral-400">Loading triggers…</p>
        ) : availableTriggers.length === 0 ? (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Every trigger already has a template. Open{" "}
            <Link to="/admin/email-templates" className="underline">
              Email templates
            </Link>{" "}
            and delete one if you want to recreate it.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="form-label" htmlFor="tpl-trigger">
                Trigger (when this email is sent)
              </label>
              <select
                id="tpl-trigger"
                className="form-select w-full"
                value={triggerKey}
                onChange={(e) => setTriggerKey(e.target.value)}
                disabled={saving}
              >
                {availableTriggers.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label} — {t.description}
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
                className="form-input min-h-[280px] w-full font-mono text-sm"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={saving}
                spellCheck={false}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Creating…" : "Create template"}
            </button>
          </form>
        )}
      </Card>
    </div>
  );
}
