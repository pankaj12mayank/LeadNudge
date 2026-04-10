import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import ThemeToggle from "../../components/ThemeToggle";
import Card from "../../components/Card";
import { useSite } from "../../context/SiteContext";
import { mediaUrl } from "../../utils/mediaUrl";
import * as authService from "../../services/authService";

export default function ForgotPassword() {
  const { site } = useSite();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const title = site?.project_name || "Sales Follow-up Console";
  const logoSrc = mediaUrl(site?.logo_url);

  async function onSubmit(e) {
    e.preventDefault();
    if (!email.trim()) {
      toast.warning("Enter the email you use to sign in.");
      return;
    }
    setSubmitting(true);
    try {
      await authService.forgotPassword(email.trim());
      toast.success(
        "If we find an account for that email, we have sent reset instructions.",
      );
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
            Reset your password
          </h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Enter your work email. We will send a secure link if an account exists.
          </p>
        </div>
        <Card title="Forgot password">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input w-full"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                autoComplete="email"
                required
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full"
            >
              {submitting ? "Sending…" : "Send reset link"}
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
