import { useEffect, useState } from "react";
import Card from "../../components/Card";
import LogoUploadZone from "../../components/LogoUploadZone";
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

  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");

  const [msg, setMsg] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [profile, branding] = await Promise.all([
      adminService.getAdminMe(),
      adminService.getAdminBranding(),
    ]);
    setDisplayName(profile.display_name || "");
    setEmail(profile.email);
    setProjectName(branding.project_name);
    setLogoPreview(branding.logo_url);
  }

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        await load();
      } catch (e) {
        if (!c) setMsg({ type: "err", text: e.message });
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
    setMsg({ type: "", text: "" });
    setSaving(true);
    try {
      const updated = await adminService.patchAdminMe({
        display_name: displayName.trim() || null,
        email: email.trim(),
      });
      setSessionEmail(updated.email);
      setMsg({ type: "ok", text: "Profile saved." });
    } catch (err) {
      setMsg({ type: "err", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    setMsg({ type: "", text: "" });
    if (newPw.length < 8) {
      setMsg({ type: "err", text: "New password must be at least 8 characters." });
      return;
    }
    if (newPw !== newPw2) {
      setMsg({ type: "err", text: "New passwords do not match." });
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
      setMsg({ type: "ok", text: "Password updated." });
    } catch (err) {
      setMsg({ type: "err", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function saveBranding(e) {
    e.preventDefault();
    setMsg({ type: "", text: "" });
    setSaving(true);
    try {
      const b = await adminService.putAdminBranding({
        project_name: projectName.trim(),
      });
      setLogoPreview(b.logo_url);
      await refreshSite();
      setMsg({ type: "ok", text: "Product name saved. Sidebar updates for everyone." });
    } catch (err) {
      setMsg({ type: "err", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(file) {
    if (!file) return;
    setMsg({ type: "", text: "" });
    setSaving(true);
    try {
      const b = await adminService.postAdminLogo(file);
      setLogoPreview(b.logo_url);
      await refreshSite();
      setMsg({ type: "ok", text: "Logo uploaded (shown in sidebar and sign-in)." });
    } catch (err) {
      setMsg({ type: "err", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  const banner =
    msg.text &&
    (msg.type === "err" ? (
      <p className="rounded-md border border-neutral-800 bg-neutral-100 px-3 py-2 text-sm text-neutral-900 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100">
        {msg.text}
      </p>
    ) : (
      <p className="rounded-md border border-neutral-400 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200">
        {msg.text}
      </p>
    ));

  if (loading) {
    return (
      <div className="p-6 text-neutral-500 dark:text-neutral-400">Loading…</div>
    );
  }

  return (
    <div className="space-y-8 p-4 lg:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Account & branding
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
          Your admin profile, password, and how the product name and logo appear in the sidebar
          and on the sign-in page (black & white friendly).
        </p>
      </div>

      {banner}

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
          <button type="submit" disabled={saving} className="btn-primary">
            Save profile
          </button>
        </form>
      </Card>

      <Card title="Change password">
        <form onSubmit={savePassword} className="max-w-md space-y-4">
          <div>
            <label className="form-label">Current password</label>
            <input
              type="password"
              className="form-input"
              value={curPw}
              onChange={(e) => setCurPw(e.target.value)}
              disabled={saving}
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="form-label">New password</label>
            <input
              type="password"
              className="form-input"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              disabled={saving}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="form-label">Confirm new password</label>
            <input
              type="password"
              className="form-input"
              value={newPw2}
              onChange={(e) => setNewPw2(e.target.value)}
              disabled={saving}
              autoComplete="new-password"
            />
          </div>
          <button type="submit" disabled={saving} className="btn-primary">
            Update password
          </button>
        </form>
      </Card>

      <Card title="Product name & logo">
        <div className="max-w-xl space-y-6">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Shown next to the menu for all admins and on the sign-in screen. Use a simple logo;
            it is displayed in grayscale so it stays readable in light and dark themes.
          </p>
          {logoPreview ? (
            <div className="flex items-center gap-4">
              <img
                src={mediaUrl(logoPreview)}
                alt="Logo preview"
                className="h-16 w-16 rounded border border-neutral-200 object-contain grayscale contrast-125 dark:border-neutral-700 dark:invert dark:contrast-100"
              />
            </div>
          ) : null}
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
            <button type="submit" disabled={saving} className="btn-primary">
              Save product name
            </button>
          </form>
          <LogoUploadZone
            disabled={saving}
            onFile={uploadLogo}
            hint="PNG, JPG, SVG or WebP — max 2 MB."
          />
        </div>
      </Card>
    </div>
  );
}
