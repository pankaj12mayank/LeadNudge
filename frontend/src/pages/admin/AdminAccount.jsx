import { useEffect, useState } from "react";
import { toast } from "sonner";
import Card from "../../components/Card";
import LogoUploadZone from "../../components/LogoUploadZone";
import PasswordField from "../../components/PasswordField";
import ResetEmailHtmlEditor from "../../components/ResetEmailHtmlEditor";
import { useAuth } from "../../hooks/useAuth";
import { useSite } from "../../context/SiteContext";
import * as adminService from "../../services/adminService";
import { mediaUrl } from "../../utils/mediaUrl";

export default function AdminAccount() {
  const { setSessionEmail } = useAuth();
  const { refreshSite } = useSite();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [projectName, setProjectName] = useState("");
  const [logoPreview, setLogoPreview] = useState(null);
  const [faviconPreview, setFaviconPreview] = useState(null);

  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");

  const [supportEmail, setSupportEmail] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("");
  const [smtpEmail, setSmtpEmail] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [hasSmtpSecret, setHasSmtpSecret] = useState(false);
  const [resetSubject, setResetSubject] = useState("");
  const [resetBody, setResetBody] = useState("");
  const [mailTestTo, setMailTestTo] = useState("");

  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [profile, branding, mail] = await Promise.all([
      adminService.getAdminMe(),
      adminService.getAdminBranding(),
      adminService.getBrandingMail(),
    ]);
    setDisplayName(profile.display_name || "");
    setEmail(profile.email);
    setProjectName(branding.project_name);
    setLogoPreview(branding.logo_url);
    setFaviconPreview(branding.favicon_url);
    setSupportEmail(mail.support_email || "");
    setSmtpHost(mail.mail_smtp_host || "");
    setSmtpPort(
      mail.mail_smtp_port != null && mail.mail_smtp_port !== ""
        ? String(mail.mail_smtp_port)
        : ""
    );
    setSmtpEmail(mail.mail_smtp_email || "");
    setSmtpPassword("");
    setHasSmtpSecret(mail.mail_smtp_password === "***");
    setResetSubject(mail.reset_email_subject || "");
    setResetBody(mail.reset_email_body || "");
  }

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        await load();
      } catch (e) {
        if (!c) setLoadError(e.message);
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await adminService.patchAdminMe({
        display_name: displayName.trim() || null,
        email: email.trim(),
      });
      setSessionEmail(updated.email);
      toast.success("Profile saved.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    if (newPw.length < 8) {
      toast.warning("New password must be at least 8 characters.");
      return;
    }
    if (newPw !== newPw2) {
      toast.warning("New passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      await adminService.postAdminPassword({
        current_password: curPw,
        new_password: newPw,
      });
      setCurPw("");
      setNewPw("");
      setNewPw2("");
      toast.success("Password updated.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveBranding(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const b = await adminService.putAdminBranding({
        project_name: projectName.trim(),
      });
      setLogoPreview(b.logo_url);
      await refreshSite();
      toast.success("Product name saved.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(file) {
    if (!file) return;
    setSaving(true);
    try {
      const b = await adminService.postAdminLogo(file);
      setLogoPreview(b.logo_url);
      await refreshSite();
      toast.success("Logo updated.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function uploadFavicon(file) {
    if (!file) return;
    setSaving(true);
    try {
      const b = await adminService.postAdminFavicon(file);
      setFaviconPreview(b.favicon_url);
      await refreshSite();
      toast.success("Favicon updated — browser tab refreshes for users on next load.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveMail(e) {
    e.preventDefault();
    const portNum = smtpPort.trim() ? parseInt(smtpPort, 10) : null;
    if (smtpPort.trim() && (Number.isNaN(portNum) || portNum < 1)) {
      toast.warning("Enter a valid SMTP port.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        support_email: supportEmail.trim() || null,
        mail_smtp_host: smtpHost.trim() || null,
        mail_smtp_port: portNum,
        mail_smtp_email: smtpEmail.trim() || null,
        reset_email_subject: resetSubject.trim() || null,
        reset_email_body: resetBody || null,
      };
      if (smtpPassword.trim()) {
        payload.mail_smtp_password = smtpPassword.trim();
      }
      const m = await adminService.putBrandingMail(payload);
      setSmtpPassword("");
      setHasSmtpSecret(m.mail_smtp_password === "***");
      toast.success("Email settings saved.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function sendTestMail(e) {
    e.preventDefault();
    const to = mailTestTo.trim();
    if (!to) {
      toast.warning("Enter an address to send the test to.");
      return;
    }
    setSaving(true);
    try {
      const r = await adminService.postBrandingMailTest(to);
      if (r?.ok) toast.success(r.message || "Test email sent.");
      else toast.error(r?.message || "Test email failed.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-neutral-500 dark:text-neutral-400">Loading…</div>
    );
  }

  return (
    <div className="w-full space-y-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="w-full border-b border-neutral-200 pb-6 dark:border-neutral-800">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Organization
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Account, mail &amp; appearance
        </h1>
        <p className="mt-2 w-full text-sm text-neutral-600 dark:text-neutral-400">
          Sign-in profile, product name, logo, favicon, and SMTP for password-reset emails.
        </p>
      </section>

      {loadError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {loadError}
        </p>
      ) : null}

      <Card title="Admin profile">
        <form onSubmit={saveProfile} className="max-w-md space-y-4">
          <div>
            <label className="form-label">Display name</label>
            <input
              className="form-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={saving}
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="form-label">Email (sign-in)</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={saving}
              required
            />
          </div>
          <button type="submit" disabled={saving} className="btn-primary w-full sm:w-auto">
            Save profile
          </button>
        </form>
      </Card>

      <Card title="Change password">
        <form onSubmit={savePassword} className="max-w-md space-y-4">
          <PasswordField
            label="Current password"
            value={curPw}
            onChange={(e) => setCurPw(e.target.value)}
            disabled={saving}
            autoComplete="current-password"
          />
          <PasswordField
            label="New password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            disabled={saving}
            autoComplete="new-password"
          />
          <PasswordField
            label="Confirm new password"
            value={newPw2}
            onChange={(e) => setNewPw2(e.target.value)}
            disabled={saving}
            autoComplete="new-password"
          />
          <button type="submit" disabled={saving} className="btn-primary w-full sm:w-auto">
            Update password
          </button>
        </form>
      </Card>

      <Card title="SMTP & password-reset email">
        <form onSubmit={saveMail} className="max-w-2xl space-y-4">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Configure these to send “forgot password” links. In the body, use{" "}
            <code className="rounded bg-neutral-100 px-1 text-xs dark:bg-neutral-800">
              {"{{reset_link}}"}
            </code>{" "}
            for the reset URL and{" "}
            <code className="rounded bg-neutral-100 px-1 text-xs dark:bg-neutral-800">
              {"{{user_name}}"}
            </code>{" "}
            for the recipient&apos;s name (or email prefix).
          </p>
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            <strong>Gmail:</strong> use <code className="text-xs">smtp.gmail.com</code>, port{" "}
            <code className="text-xs">587</code>, and a Google{" "}
            <strong>App password</strong> if 2-Step Verification is enabled (normal passwords return
            error 534).
          </p>
          <div>
            <label className="form-label">Support email (shown to users)</label>
            <input
              type="email"
              className="form-input"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              disabled={saving}
              placeholder="support@yourcompany.com"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="form-label">SMTP host</label>
              <input
                className="form-input"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                disabled={saving}
                placeholder="smtp.example.com"
              />
            </div>
            <div>
              <label className="form-label">SMTP port</label>
              <input
                type="number"
                className="form-input"
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
                disabled={saving}
                placeholder="587"
                min={1}
                max={65535}
              />
            </div>
            <div>
              <label className="form-label">SMTP username / sender email</label>
              <input
                type="email"
                className="form-input"
                value={smtpEmail}
                onChange={(e) => setSmtpEmail(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="sm:col-span-2">
              <PasswordField
                label={
                  hasSmtpSecret
                    ? "SMTP password (leave blank to keep current)"
                    : "SMTP password"
                }
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
                disabled={saving}
                autoComplete="new-password"
              />
            </div>
          </div>
          <div>
            <label className="form-label">Reset email subject</label>
            <input
              className="form-input"
              value={resetSubject}
              onChange={(e) => setResetSubject(e.target.value)}
              disabled={saving}
              placeholder="Reset your password"
            />
          </div>
          <div>
            <label className="form-label">Reset email body (HTML)</label>
            <ResetEmailHtmlEditor
              value={resetBody}
              onChange={setResetBody}
              disabled={saving}
            />
          </div>
          <button type="submit" disabled={saving} className="btn-primary w-full sm:w-auto">
            Save email settings
          </button>
        </form>
        <form onSubmit={sendTestMail} className="mt-6 flex max-w-2xl flex-col gap-3 border-t border-neutral-200 pt-6 dark:border-neutral-700 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label className="form-label">Send test email to</label>
            <input
              type="email"
              className="form-input"
              value={mailTestTo}
              onChange={(e) => setMailTestTo(e.target.value)}
              disabled={saving}
              placeholder="you@example.com"
            />
          </div>
          <button type="submit" disabled={saving} className="btn-secondary w-full shrink-0 sm:w-auto">
            Test email
          </button>
        </form>
      </Card>

      <Card title="Product name, logo & favicon">
        <div className="max-w-xl space-y-6">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Shown in the sidebar and on sign-in. Logos are displayed in grayscale. The favicon
            appears in the browser tab.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            {logoPreview ? (
              <img
                src={mediaUrl(logoPreview)}
                alt="Logo preview"
                className="h-16 w-16 rounded border border-neutral-200 object-contain grayscale contrast-125 dark:border-neutral-700 dark:invert dark:contrast-100"
              />
            ) : null}
            {faviconPreview ? (
              <img
                src={mediaUrl(faviconPreview)}
                alt="Favicon preview"
                className="h-10 w-10 rounded border border-neutral-200 object-contain dark:border-neutral-700"
              />
            ) : null}
          </div>
          <form onSubmit={saveBranding} className="space-y-4">
            <div>
              <label className="form-label">Product name</label>
              <input
                className="form-input"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                disabled={saving}
                required
              />
            </div>
            <button type="submit" disabled={saving} className="btn-primary w-full sm:w-auto">
              Save product name
            </button>
          </form>
          <LogoUploadZone
            disabled={saving}
            onFile={uploadLogo}
            hint="PNG, JPG, SVG or WebP — max 2 MB."
          />
          <LogoUploadZone
            label="Favicon"
            disabled={saving}
            onFile={uploadFavicon}
            hint="Square PNG or ICO works best — max 2 MB."
          />
        </div>
      </Card>
    </div>
  );
}
