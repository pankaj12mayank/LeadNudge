import { useEffect, useState } from "react";
import { useSite } from "../context/SiteContext";
import * as userService from "../services/userService";

/** Sticky alert when workspace AI quota is exhausted (scheduling blocked until admin raises limit). */
export default function UsageLimitBanner() {
  const { site } = useSite();
  const supportEmail = site?.support_email;
  const [planExpired, setPlanExpired] = useState(false);
  const [exhausted, setExhausted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const s = await userService.getSettings();
        if (!cancelled) {
          setPlanExpired(Boolean(s.plan_expired));
          setExhausted(Boolean(s.ai_quota_exhausted));
        }
      } catch {
        if (!cancelled) {
          setPlanExpired(false);
          setExhausted(false);
        }
      }
    }
    tick();
    const id = setInterval(tick, 45_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!planExpired && !exhausted) return null;

  if (planExpired) {
    return (
      <div
        className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-100"
        role="alert"
      >
        <p className="font-semibold">Workspace plan expired</p>
        <p className="mt-1">
          AI follow-ups and generated messages are disabled until your administrator renews the
          plan (Admin → Workspaces). You can still sign in and use the rest of the dashboard.
        </p>
        {supportEmail ? (
          <p className="mt-2">
            <a className="font-medium underline" href={`mailto:${supportEmail}`}>
              {supportEmail}
            </a>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-100"
      role="alert"
    >
      <p className="font-semibold">AI message quota exhausted</p>
      <p className="mt-1">
        New AI follow-ups cannot be scheduled until your administrator increases your workspace
        limit (Admin → AI setup). Please contact your administrator to upgrade or extend your
        monthly allowance.
      </p>
      {supportEmail ? (
        <p className="mt-2">
          <a className="font-medium underline" href={`mailto:${supportEmail}`}>
            {supportEmail}
          </a>
        </p>
      ) : null}
    </div>
  );
}
