import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import Card from "../../components/Card";
import * as adminService from "../../services/adminService";

const PLACEHOLDER_HELP =
  "Placeholders: {{name}}, {{email}}, {{password}}, {{user_name}}, {{project_name}}.";

export default function EmailTemplateEdit() {
  const { templateName } = useParams();
  const navigate = useNavigate();
  const name = useMemo(
    () => (templateName ? decodeURIComponent(templateName) : ""),
    [templateName],
  );

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [initialSubj, setInitialSubj] = useState("");
  const [initialBody, setInitialBody] = useState("");

  useEffect(() => {
    if (!name) return;
    let c = false;
    (async () => {
      setLoading(true);
      try {
        const row = await adminService.getEmailTemplate(name);
        if (c) return;
        const s = row.subject || "";
        const b = row.body || "";
        setSubject(s);
        setBody(b);
        setInitialSubj(s);
        setInitialBody(b);
      } catch (e) {
        if (!c) {
          toast.error(e.message);
          navigate("/admin/email-templates", { replace: true });
        }
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [name, navigate]);

  const dirty =
    subject.trim() !== initialSubj.trim() || body !== initialBody;

  async function onSave(e) {
    e.preventDefault();
    if (!name || !dirty) {
      toast.message("No changes to save");
      return;
    }
    setSaving(true);
    try {
      await adminService.putEmailTemplate(name, { subject, body });
      toast.success("Template saved");
      setInitialSubj(subject);
      setInitialBody(body);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (
      !confirm(
        "Delete this template? Emails for this trigger will fail until you create a new template.",
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await adminService.deleteEmailTemplate(name);
      toast.success("Template deleted");
      navigate("/admin/email-templates", { replace: true });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDeleting(false);
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
          {name.replace(/_/g, " ")}
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          {PLACEHOLDER_HELP}
        </p>
      </section>

      <Card title="Edit">
        {loading ? (
          <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
        ) : (
          <form onSubmit={onSave} className="space-y-4">
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
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="btn-primary"
                disabled={saving || deleting || !dirty}
              >
                {saving ? "Saving…" : "Save template"}
              </button>
              <button
                type="button"
                className="btn-secondary border-red-200 text-red-800 hover:bg-red-50 dark:border-red-900 dark:text-red-200 dark:hover:bg-red-950/40"
                disabled={saving || deleting}
                onClick={onDelete}
              >
                {deleting ? "Deleting…" : "Delete template"}
              </button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
