import { useEffect, useRef } from "react";
import { toast } from "sonner";
import * as userService from "../services/userService";

/** Polls pending follow-ups and notifies ~5 minutes before scheduled_at. */
export default function FollowupReminderListener() {
  const notified = useRef(new Set());

  useEffect(() => {
    const keyFor = (id, scheduledAt) => `${id}:${scheduledAt}`;

    const tick = async () => {
      try {
        const f = await userService.listFollowups(undefined, {
          page: 1,
          limit: 100,
        });
        const items = f.items ?? [];
        const now = Date.now();
        for (const row of items) {
          if (row.status !== "pending") continue;
          const t = new Date(row.scheduled_at).getTime();
          if (Number.isNaN(t)) continue;
          const msUntil = t - now;
          if (msUntil <= 0 || msUntil > 5 * 60 * 1000) continue;
          const k = keyFor(row.id, row.scheduled_at);
          if (notified.current.has(k)) continue;
          notified.current.add(k);
          const mins = Math.max(1, Math.round(msUntil / 60000));
          const who = row.lead_name
            ? `${row.lead_name} (lead #${row.lead_id})`
            : `Lead #${row.lead_id}`;
          toast.info("Follow-up coming up", {
            description: `In about ${mins} minute${mins === 1 ? "" : "s"} — ${who}. Check Follow-ups when you are ready.`,
            duration: 14_000,
          });
        }
      } catch {
        /* session / network */
      }
    };

    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  return null;
}
