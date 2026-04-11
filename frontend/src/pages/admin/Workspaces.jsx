import { useEffect, useState } from "react";
import { toast } from "sonner";
import Card from "../../components/Card";
import Badge from "../../components/Badge";
import * as adminService from "../../services/adminService";
import {
  workspaceDescription,
  workspaceLabel,
} from "../../utils/workspaceLabel";

export default function Workspaces() {
  const [rows, setRows] = useState([]);
  const [pending, setPending] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  async function refresh() {
    const data = await adminService.listWorkspaces();
    setRows(data);
  }

  useEffect(() => {
    let c = false;
    (async () => {
      setLoading(true);
      try {
        await refresh();
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

  async function savePlan(workspaceId, planType) {
    setSavingId(workspaceId);
    try {
      await adminService.updateWorkspacePlan(workspaceId, planType);
      toast.success("Plan updated for this workspace.");
      setPending((p) => ({ ...p, [workspaceId]: undefined }));
      await refresh();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="w-full max-w-none space-y-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="w-full max-w-none border-b border-neutral-200 pb-6 dark:border-neutral-800">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Tenant pools
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Free &amp; Pro capacity
        </h1>
        <p className="mt-2 w-full max-w-none text-sm text-neutral-600 dark:text-neutral-400">
          The product uses <strong>two fixed workspaces</strong> only. Pick which plan each pool
          represents, then assign users from <strong>Team</strong>. You cannot create extra
          workspaces.
        </p>
      </section>

      {loading ? (
        <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
      ) : (
        <div className="flex w-full max-w-none flex-col gap-6">
          {rows.map((r) => {
            const current = r.plan_type ?? "free";
            const sel = pending[r.id] !== undefined ? pending[r.id] : current;
            const dirty = pending[r.id] !== undefined && pending[r.id] !== current;
            return (
              <Card key={r.id} noBodyPadding title={workspaceLabel(r.name)}>
                <div className="space-y-4 p-5 sm:p-6">
                  <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                    {workspaceDescription(r.name)}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-500">
                    <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono dark:bg-neutral-900">
                      Ref #{r.id}
                    </span>
                    <span aria-hidden>·</span>
                    <span>Used when inviting users to this plan</span>
                  </div>
                  <div className="border-t border-neutral-200 pt-4 dark:border-neutral-700">
                    <p className="form-label">Billing plan for this pool</p>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                      <Badge
                        className="w-fit shrink-0"
                        variant={current === "pro" ? "solid" : "muted"}
                      >
                        Current: {current === "pro" ? "Pro (paid)" : "Free"}
                      </Badge>
                      <select
                        className="form-select min-h-[42px] w-full flex-1 sm:min-w-[200px] sm:max-w-md"
                        value={sel}
                        disabled={savingId === r.id}
                        onChange={(e) =>
                          setPending((p) => ({ ...p, [r.id]: e.target.value }))
                        }
                        aria-label={`Plan for ${workspaceLabel(r.name)}`}
                      >
                        <option value="free">Free</option>
                        <option value="pro">Pro (paid)</option>
                      </select>
                      <button
                        type="button"
                        className="btn-primary h-[42px] w-full shrink-0 px-6 sm:w-auto sm:min-w-[8.5rem]"
                        disabled={!dirty || savingId === r.id}
                        onClick={() => savePlan(r.id, pending[r.id])}
                      >
                        {savingId === r.id ? "Saving…" : "Save plan"}
                      </button>
                    </div>
                    {dirty ? (
                      <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
                        You changed the plan — press <strong>Save plan</strong> to apply.
                      </p>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
