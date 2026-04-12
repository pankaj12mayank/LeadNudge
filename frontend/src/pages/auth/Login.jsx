import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import ThemeToggle from "../../components/ThemeToggle";
import Card from "../../components/Card";
import PasswordField from "../../components/PasswordField";
import { useAuth } from "../../hooks/useAuth";
import { useSite } from "../../context/SiteContext";
import { mediaUrl } from "../../utils/mediaUrl";
import {
  SESSION_PLAN_EXPIRED_TOAST_KEY,
  SESSION_QUOTA_TOAST_KEY,
} from "../../utils/constants";
import * as authService from "../../services/authService";
import * as userService from "../../services/userService";

function brandInitials(name) {
  const t = (name || "").trim();
  if (!t) return "SF";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Login() {
  const { login, logout, isAuthenticated, role, loading } = useAuth();
  const { site } = useSite();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reqOpen, setReqOpen] = useState(false);
  const [reqEmail, setReqEmail] = useState("");
  const [reqSending, setReqSending] = useState(false);

  const title = site?.project_name || "Sales Follow-up Console";
  const logoSrc = mediaUrl(site?.logo_url);
  const initials = brandInitials(title);

  if (isAuthenticated) {
    if (from && from !== "/login") {
      return <Navigate to={from} replace />;
    }
    return (
      <div className="relative min-h-screen bg-neutral-50 dark:bg-black">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-12">
          <Card title="You are already signed in">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Continue to your workspace, or sign out to use a different account.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="btn-primary w-full sm:flex-1"
                onClick={() =>
                  navigate(
                    role === "admin" ? "/admin/dashboard" : "/dashboard",
                    { replace: true },
                  )
                }
              >
                Continue
              </button>
              <button
                type="button"
                className="btn-secondary w-full sm:flex-1"
                onClick={() => {
                  logout();
                  toast.success("Signed out");
                }}
              >
                Sign out
              </button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setSubmitting(true);
    try {
      const data = await login({ email: email.trim(), password });
      toast.success("Welcome back");
      if (data.role === "user") {
        try {
          const s = await userService.getSettings();
          if (s.plan_expired && !sessionStorage.getItem(SESSION_PLAN_EXPIRED_TOAST_KEY)) {
            sessionStorage.setItem(SESSION_PLAN_EXPIRED_TOAST_KEY, "1");
            toast.error("Your plan has expired", {
              description:
                "Contact your administrator to renew or upgrade. You can still use the dashboard; AI follow-ups stay disabled until the plan is active again.",
              duration: 12_000,
            });
          } else if (
            s.ai_quota_exhausted &&
            !sessionStorage.getItem(SESSION_QUOTA_TOAST_KEY)
          ) {
            sessionStorage.setItem(SESSION_QUOTA_TOAST_KEY, "1");
            toast.error("AI message limit khatam ho chuka hai", {
              description:
                "Is period ke liye aapka AI message limit poora use ho gaya hai. Apne administrator se contact karke limit ya plan update karwayein.",
              duration: 14_000,
            });
          }
        } catch {
          /* notices optional */
        }
      }
      navigate(
        data.role === "admin" ? "/admin/dashboard" : "/dashboard",
        { replace: true },
      );
    } catch (err) {
      setError(err.message || "Sign-in failed.");
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
              {initials}
            </div>
          )}
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            {title}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Administrators and team members use the same page. After you sign in,
            you will land in the area that matches your account.
          </p>
        </div>

        <Card title="Credentials">
          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <p className="rounded-md border border-neutral-800 bg-neutral-100 px-3 py-2 text-sm text-neutral-900 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100">
                {error}
              </p>
            )}
            <div>
              <label className="form-label">Work email</label>
              <input
                type="email"
                autoComplete="username"
                className="form-input w-full"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting || loading}
                required
              />
            </div>
            <PasswordField
              label="Password"
              className="form-input w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting || loading}
              autoComplete="current-password"
              required
            />
            <button
              type="submit"
              disabled={submitting || loading}
              className="btn-primary w-full"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
            <p className="text-center text-sm">
              <button
                type="button"
                className="font-medium text-neutral-900 underline decoration-neutral-400 underline-offset-2 dark:text-neutral-100"
                onClick={() => {
                  setReqEmail(email.trim());
                  setReqOpen(true);
                }}
              >
                Request password reset
              </button>
            </p>
          </form>
        </Card>

        {reqOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pw-req-title"
          >
            <Card title="Request password help" className="relative z-10 w-full max-w-md shadow-xl">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Enter your work email. An administrator will set a new password and you will receive
                login instructions by email when SMTP is configured.
              </p>
              <div className="mt-4">
                <label className="form-label">Work email</label>
                <input
                  type="email"
                  className="form-input w-full"
                  value={reqEmail}
                  onChange={(e) => setReqEmail(e.target.value)}
                  disabled={reqSending}
                  autoComplete="email"
                />
              </div>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  className="btn-secondary w-full sm:w-auto"
                  disabled={reqSending}
                  onClick={() => setReqOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary w-full sm:w-auto"
                  disabled={reqSending || !reqEmail.trim()}
                  onClick={async () => {
                    setReqSending(true);
                    try {
                      await authService.requestPasswordResetFromAdmin(reqEmail.trim());
                      toast.success("Your request has been sent to the admin.");
                      setReqOpen(false);
                    } catch (e) {
                      toast.error(e.message || "Could not submit request.");
                    } finally {
                      setReqSending(false);
                    }
                  }}
                >
                  {reqSending ? "Sending…" : "Submit request"}
                </button>
              </div>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}
