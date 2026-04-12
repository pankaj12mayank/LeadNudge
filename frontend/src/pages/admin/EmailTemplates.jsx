import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import Card from "../../components/Card";
import * as adminService from "../../services/adminService";

const PLACEHOLDER_HELP =
  "Placeholders: {{name}}, {{email}}, {{password}}, {{user_name}}, {{project_name}}.";

function titleCase(name) {
  return String(name || "").replace(/_/g, " ");
}

export default function EmailTemplates() {
  const [triggers, setTriggers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await adminService.listEmailTemplateTriggers();
      setTriggers(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e.message);
      setTriggers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onDelete(key) {
    if (
      !confirm(
        `Delete the email template for "${titleCase(key)}"? Transactional emails for this event will fail until you create a new template.`,
      )
    ) {
      return;
    }
    setDeleting(key);
    try {
      await adminService.deleteEmailTemplate(key);
      toast.success("Template deleted");
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDeleting(null);
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
          Each <strong>trigger</strong> (when the system sends mail) may have at most one template.
          Edit an existing template, delete to remove it, then use <strong>Add template</strong> to
          attach a new one to a free trigger. SMTP must be set under Account &amp; branding.{" "}
          {PLACEHOLDER_HELP}
        </p>
        <div className="mt-4">
          <Link to="/admin/email-templates/new" className="btn-primary inline-block">
            Add template
          </Link>
        </div>
      </section>

      <Card title="Triggers & templates">
        {loading ? (
          <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-700">
                  <th className="py-2 pr-4 font-medium text-neutral-900 dark:text-neutral-100">
                    Trigger
                  </th>
                  <th className="py-2 pr-4 font-medium text-neutral-900 dark:text-neutral-100">
                    When it fires
                  </th>
                  <th className="py-2 pr-4 font-medium text-neutral-900 dark:text-neutral-100">
                    Status
                  </th>
                  <th className="py-2 font-medium text-neutral-900 dark:text-neutral-100">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {triggers.map((t) => (
                  <tr
                    key={t.key}
                    className="border-b border-neutral-100 dark:border-neutral-800"
                  >
                    <td className="py-3 pr-4 align-top font-medium capitalize text-neutral-900 dark:text-neutral-100">
                      {titleCase(t.key)}
                    </td>
                    <td className="py-3 pr-4 align-top text-neutral-600 dark:text-neutral-400">
                      {t.description}
                    </td>
                    <td className="py-3 pr-4 align-top">
                      {t.has_template ? (
                        <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                          Template saved
                        </span>
                      ) : (
                        <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                          No template — emails for this event will fail
                        </span>
                      )}
                    </td>
                    <td className="py-3 align-top">
                      <div className="flex flex-wrap gap-2">
                        {t.has_template ? (
                          <>
                            <Link
                              to={`/admin/email-templates/${encodeURIComponent(t.key)}`}
                              className="text-sm font-medium text-blue-700 underline dark:text-blue-400"
                            >
                              Edit
                            </Link>
                            <button
                              type="button"
                              disabled={deleting === t.key}
                              className="text-sm font-medium text-red-700 underline disabled:opacity-50 dark:text-red-400"
                              onClick={() => onDelete(t.key)}
                            >
                              {deleting === t.key ? "Deleting…" : "Delete"}
                            </button>
                          </>
                        ) : (
                          <Link
                            to={`/admin/email-templates/new?trigger=${encodeURIComponent(t.key)}`}
                            className="text-sm font-medium text-blue-700 underline dark:text-blue-400"
                          >
                            Create for this trigger
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
