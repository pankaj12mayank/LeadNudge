import { useEffect, useState } from "react";
import { toast } from "sonner";
import Card from "../../components/Card";
import * as userService from "../../services/userService";

export default function Dashboard() {
  const [leads, setLeads] = useState(0);
  const [followups, setFollowups] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const [l, f] = await Promise.all([
          userService.listLeads(undefined, { page: 1, limit: 1 }),
          userService.listFollowups(undefined, { page: 1, limit: 1 }),
        ]);
        if (!c) {
          setLeads(l.total ?? 0);
          setFollowups(f.total ?? 0);
        }
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
    <div className="space-y-8 p-4 lg:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Overview
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Counts for your workspace only.
        </p>
      </div>
      {loading ? (
        <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card noBodyPadding>
            <div className="p-6">
              <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                Leads
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                {leads}
              </p>
            </div>
          </Card>
          <Card noBodyPadding>
            <div className="p-6">
              <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                Follow-ups
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                {followups}
              </p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
