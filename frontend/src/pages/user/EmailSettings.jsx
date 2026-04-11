import { useEffect, useState } from "react";
import { toast } from "sonner";
import Card from "../../components/Card";
import PasswordField from "../../components/PasswordField";
import * as userService from "../../services/userService";

export default function EmailSettings() {
  const [host, setHost] = useState("");
  const [port, setPort] = useState(587);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

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
    setSaving(true);
    try {
      const payload = {
        smtp_host: host.trim(),
        smtp_port: Number(port),
        smtp_email: email.trim(),
      };
      if (password.trim()) {
        payload.smtp_password = password.trim();
      }
      await userService.updateSettings(payload);
      toast.success("Email settings saved");
      setPassword("");
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
          When a follow-up runs, the app can email the lead using these SMTP settings.
        </p>
      </section>

      <Card title="Outgoing mail">
        {loading ? (
          <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
        ) : (
          <form onSubmit={onSave} className="max-w-lg space-y-4">
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
                required
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
                required
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
                required
              />
            </div>
            <PasswordField
              label="SMTP password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={saving}
              placeholder="Leave blank to keep current password"
              autoComplete="new-password"
            />
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
                {testing ? "Testing…" : "Test connection"}
              </button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
