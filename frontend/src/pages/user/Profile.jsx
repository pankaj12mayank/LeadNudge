import { useEffect, useState } from "react";
import { toast } from "sonner";
import Card from "../../components/Card";
import PasswordField from "../../components/PasswordField";
import { useAuth } from "../../hooks/useAuth";
import * as userService from "../../services/userService";

export default function Profile() {
  const { refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const a = await userService.getAccount();
        if (!c) {
          setDisplayName(a.display_name || "");
          setPhone(a.phone || "");
          setEmail(a.email || "");
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

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await userService.patchAccount({
        display_name: displayName.trim() || null,
        phone: phone.trim() || null,
      });
      await refreshProfile();
      toast.success("Profile saved");
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
      toast.warning("Passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      await userService.postAccountPassword({
        current_password: curPw,
        new_password: newPw,
      });
      setCurPw("");
      setNewPw("");
      setNewPw2("");
      toast.success("Password updated");
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
          Your account
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Your details &amp; password
        </h1>
        <p className="mt-2 w-full text-sm text-neutral-600 dark:text-neutral-400">
          Update how your name appears in the header, your phone number, and your password.
        </p>
      </section>

      <Card title="Profile">
        <form onSubmit={saveProfile} className="max-w-md space-y-4">
          <div>
            <label className="form-label">Email</label>
            <input className="form-input bg-neutral-100 dark:bg-neutral-900" value={email} readOnly />
          </div>
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
            <label className="form-label">Phone</label>
            <input
              className="form-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={saving}
              placeholder="Optional"
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
            className="form-input"
            value={curPw}
            onChange={(e) => setCurPw(e.target.value)}
            disabled={saving}
            autoComplete="current-password"
          />
          <PasswordField
            label="New password"
            className="form-input"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            disabled={saving}
            autoComplete="new-password"
          />
          <PasswordField
            label="Confirm new password"
            className="form-input"
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
    </div>
  );
}
