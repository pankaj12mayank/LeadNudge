import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import ThemeToggle from "../../components/ThemeToggle";
import Card from "../../components/Card";
import PasswordField from "../../components/PasswordField";
import { useSite } from "../../context/SiteContext";
import { mediaUrl } from "../../utils/mediaUrl";
import * as authService from "../../services/authService";

export default function ResetPassword() {
  const { site } = useSite();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const title = site?.project_name || "Sales Follow-up Console";
  const logoSrc = mediaUrl(site?.logo_url);

  async function onSubmit(e) {
    e.preventDefault();
    if (pw.length < 8) {
      toast.warning("Password must be at least 8 characters.");
      return;
    }
    if (pw !== pw2) {
      toast.warning("Passwords do not match.");
      return;
    }
    if (!token) {
      toast.error("Invalid or missing reset link.");
      return;
    }
    setSubmitting(true);
    try {
      await authService.resetPassword(token, pw);
      toast.success("Password updated. You can sign in now.");
      navigate("/login", { replace: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-neutral-50 dark:bg-black">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-4 py-12">
        <div className="mb-8 text-center">
          {logoSrc ? (
            <img
              src={logoSrc}
              alt=""
              className="mx-auto mb-4 h-14 w-14 object-contain grayscale contrast-125 dark:invert dark:contrast-100"
            />
          ) : (
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg border-2 border-neutral-900 text-sm font-bold dark:border-white">
              {title.slice(0, 2).toUpperCase()}
            </div>
          )}
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            Choose a new password
          </h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Use a strong password you have not used elsewhere.
          </p>
        </div>
        <Card title="New password">
          <form onSubmit={onSubmit} className="space-y-4">
            <PasswordField
              label="New password"
              className="form-input w-full"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              disabled={submitting}
              autoComplete="new-password"
              required
            />
            <PasswordField
              label="Confirm password"
              className="form-input w-full"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              disabled={submitting}
              autoComplete="new-password"
              required
            />
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full"
            >
              {submitting ? "Saving…" : "Update password"}
            </button>
            <p className="text-center text-sm">
              <Link
                to="/login"
                className="font-medium text-neutral-900 underline decoration-neutral-400 underline-offset-2 dark:text-neutral-100"
              >
                Back to sign in
              </Link>
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
