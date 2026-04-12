import { useCallback, useEffect, useState } from "react";
import { useAuthContext } from "../context/AuthContext";
import { useSite } from "../context/SiteContext";
import * as userService from "../services/userService";

/** Plan expiry vs quota — matches GET /settings flags (refreshed on interval / tab focus). */
export default function UsageLimitBanner() {
  const { site } = useSite();
  const { role, refreshProfile } = useAuthContext();
  const supportEmail = site?.support_email;
  const [planExpired, setPlanExpired] = useState(false);
  const [exhausted, setExhausted] = useState(false);

  const refreshQuotaState = useCallback(async () => {
    try {
      if (role === "user") {
        await refreshProfile();
      }
      const s = await userService.getSettings();
      setPlanExpired(Boolean(s.plan_expired));
      setExhausted(Boolean(s.ai_quota_exhausted));
    } catch {
      setPlanExpired(false);
      setExhausted(false);
    }
  }, [refreshProfile, role]);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      if (cancelled) return;
      await refreshQuotaState();
    }
    tick();
    const id = setInterval(tick, 60_000);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refreshQuotaState]);

  if (!planExpired && !exhausted) return null;

  if (planExpired) {
    return (
      <div
        className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-100"
        role="alert"
      >
        <p className="font-semibold">Workspace plan expired</p>
        <p className="mt-1">
          AI follow-ups and generated messages are disabled until your administrator renews the plan
          (Admin → Workspaces) or restores your usage allowance. You can still sign in and use the rest
          of the dashboard.
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
      <p className="font-semibold">AI message limit reached</p>
      <p className="mt-1">
        You cannot schedule new AI follow-ups until your administrator raises your AI message limit
        (Admin → Users) or the workspace cap (Admin → AI setup).
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
