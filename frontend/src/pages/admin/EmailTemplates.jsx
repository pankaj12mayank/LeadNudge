import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import * as adminService from "../../services/adminService";

const PLACEHOLDER_HELP =
  "Placeholders: {{name}}, {{email}}, {{password}}, {{user_name}}, {{project_name}}.";

function titleCase(name) {
  return String(name || "").replace(/_/g, " ");
}

export default function EmailTemplates() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let c = false;
    (async () => {
      setLoading(true);
      try {
        const data = await adminService.listEmailTemplates();
        if (!c) setRows(Array.isArray(data) ? data : []);
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
          Choose a template to edit subject and HTML body. SMTP must be set under Account &amp;
          branding. {PLACEHOLDER_HELP}
        </p>
      </section>

      {loading ? (
        <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <Link
              key={r.name}
              to={`/admin/email-templates/${encodeURIComponent(r.name)}`}
              className="block rounded-lg border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-400 hover:shadow dark:border-neutral-700 dark:bg-neutral-950 dark:hover:border-neutral-500"
            >
              <h2 className="text-base font-semibold capitalize text-neutral-900 dark:text-neutral-100">
                {titleCase(r.name)}
              </h2>
              <p className="mt-2 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-400">
                {r.subject || "—"}
              </p>
              <p className="mt-3 text-xs font-medium text-blue-700 dark:text-blue-400">
                Edit →
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
