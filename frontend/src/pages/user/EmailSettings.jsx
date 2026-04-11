import { useEffect, useState } from "react";
import { toast } from "sonner";
import Card from "../../components/Card";
import * as userService from "../../services/userService";

export default function EmailSettings() {
  const [host, setHost] = useState("");
  const [port, setPort] = useState(587);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [outboundSent, setOutboundSent] = useState(0);
  const [smtpReady, setSmtpReady] = useState(false);
  const [hasSavedPassword, setHasSavedPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const s = await userService.getSettings();
        if (c) return;
        setHost(s.smtp_host || "");
        setPort(s.smtp_port ?? 587);
        setEmail(s.smtp_email || "");
        setPassword("");
        setHasSavedPassword(s.smtp_password === "***");
        setOutboundSent(s.outbound_emails_sent ?? 0);
        setSmtpReady(Boolean(s.smtp_fully_configured));
      } catch (e) {
        toast.error(e.message);
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  async function onSave(e) {
    e.preventDefault();
    const h = host.trim();
    const em = email.trim();
    const p = Number(port);
    if (!h) {
      toast.warning("SMTP host is required.");
      return;
    }
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      toast.warning("Enter a valid sender email address.");
      return;
    }
    if (!Number.isFinite(p) || p < 1 || p > 65535) {
      toast.warning("SMTP port must be between 1 and 65535.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        smtp_host: h,
        smtp_port: p,
        smtp_email: em,
      };
      if (password.trim()) {
        payload.smtp_password = password.trim();
      }
      await userService.updateSettings(payload);
      toast.success("Email settings saved");
      if (password.trim()) {
        setPassword("");
      }
      const s2 = await userService.getSettings();
      setHasSavedPassword(s2.smtp_password === "***");
      setOutboundSent(s2.outbound_emails_sent ?? 0);
      setSmtpReady(Boolean(s2.smtp_fully_configured));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function onTest() {
    setTesting(true);
    try {
      const r = await userService.testSmtp();
      if (r.ok) toast.success(r.message);
      else toast.warning(r.message);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="w-full space-y-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="w-full border-b border-neutral-200 pb-6 dark:border-neutral-800">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Delivery
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Outgoing mail for your workspace
        </h1>
        <p className="mt-2 w-full text-sm text-neutral-600 dark:text-neutral-400">
          When a scheduled follow-up time is reached, the server generates a draft. If SMTP is
          complete below, that email is sent to the lead automatically and recorded under{" "}
          <strong className="font-medium text-neutral-800 dark:text-neutral-200">Sent mail</strong>.
          Without SMTP, you copy the draft from Follow-ups.
        </p>
        {!loading ? (
          <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
            Status:{" "}
            <span className="font-medium text-neutral-900 dark:text-neutral-100">
              {smtpReady ? "SMTP ready — auto-send enabled" : "SMTP incomplete — drafts only"}
            </span>
            {" · "}
            Emails sent from this workspace:{" "}
            <span className="font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
              {outboundSent}
            </span>
          </p>
        ) : null}
      </section>

      <Card title="Outgoing mail">
        {loading ? (
          <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
        ) : (
          <form onSubmit={onSave} className="max-w-lg space-y-4">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-neutral-700 dark:text-neutral-300">
              <li>Enter your SMTP host (e.g. smtp.gmail.com).</li>
              <li>Enter the port (587 or 465).</li>
              <li>Enter the sender email (login username for most providers).</li>
              <li>Enter the password (leave blank to keep a saved password).</li>
              <li>Click <strong className="font-medium">Test email</strong> to verify, then Save.</li>
            </ol>
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <strong>Gmail / Google:</strong> use <code className="text-xs">smtp.gmail.com</code>, port{" "}
              <code className="text-xs">587</code>, your full email, and an{" "}
              <strong>App Password</strong> (not your normal password) if 2-Step Verification is on.
              Create one under Google Account → Security → App passwords.
            </p>
            <div>
              <label className="form-label">SMTP host</label>
              <input
                className="form-input"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                disabled={saving}
                placeholder="smtp.example.com"
              />
            </div>
            <div>
              <label className="form-label">SMTP port</label>
              <input
                type="number"
                min={1}
                max={65535}
                className="form-input max-w-xs"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                disabled={saving}
              />
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Common: 587 (STARTTLS), 465 (SSL).
              </p>
            </div>
            <div>
              <label className="form-label">SMTP username / from address</label>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={saving}
                placeholder="you@company.com"
              />
            </div>
            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <label className="form-label mb-0">SMTP password</label>
                <button
                  type="button"
                  className="text-xs font-medium text-neutral-600 underline dark:text-neutral-400"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {hasSavedPassword && !password.trim() ? (
                <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
                  A password is already saved (stored encrypted on the server). Type a new value only
                  if you want to replace it.
                </p>
              ) : null}
              <input
                type={showPassword ? "text" : "password"}
                className="form-input w-full font-mono text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={saving}
                placeholder={
                  hasSavedPassword && !password.trim()
                    ? "•••••••• (saved — enter new to change)"
                    : "SMTP password"
                }
                autoComplete="new-password"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving || testing}
                className="btn-primary"
              >
                Save
              </button>
              <button
                type="button"
                disabled={saving || testing}
                className="btn-secondary"
                onClick={onTest}
              >
                {testing ? "Testing…" : "Test email"}
              </button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
