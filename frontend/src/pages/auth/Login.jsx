import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import ThemeToggle from "../../components/ThemeToggle";
import Card from "../../components/Card";
import { useAuth } from "../../hooks/useAuth";
import { useSite } from "../../context/SiteContext";
import { mediaUrl } from "../../utils/mediaUrl";

export default function Login() {
  const { login, isAuthenticated, role, loading } = useAuth();
  const { site } = useSite();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const title = site?.project_name || "Sales Follow-up Console";
  const logoSrc = mediaUrl(site?.logo_url);

  if (isAuthenticated) {
    if (from && from !== "/login") {
      return <Navigate to={from} replace />;
    }
    return (
      <Navigate
        to={role === "admin" ? "/admin/dashboard" : "/dashboard"}
        replace
      />
    );
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Enter email and password.");
      return;
    }
    setSubmitting(true);
    try {
      const data = await login({ email: email.trim(), password });
      navigate(
        data.role === "admin" ? "/admin/dashboard" : "/dashboard",
        { replace: true }
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
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <div className="mb-8 flex max-w-md flex-col items-center text-center">
          {logoSrc ? (
            <img
              src={logoSrc}
              alt=""
              className="mb-4 h-14 w-14 object-contain grayscale contrast-125 dark:invert dark:contrast-100"
            />
          ) : (
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg border-2 border-neutral-900 text-sm font-bold dark:border-white">
              SF
            </div>
          )}
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-2xl">
            {title}
          </h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            One sign-in page for everyone: <strong>administrators</strong> and{" "}
            <strong>workspace users</strong>. Your account type decides which area
            opens after you sign in.
          </p>
        </div>

        <div className="w-full max-w-md">
          <Card title="Sign in">
            <form onSubmit={onSubmit} className="space-y-4">
              {error && (
                <p className="rounded-md border border-neutral-800 bg-neutral-100 px-3 py-2 text-sm text-neutral-900 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100">
                  {error}
                </p>
              )}
              <div>
                <label className="form-label">Email</label>
                <input
                  type="email"
                  autoComplete="username"
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting || loading}
                />
              </div>
              <div>
                <label className="form-label">Password</label>
                <input
                  type="password"
                  autoComplete="current-password"
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting || loading}
                />
              </div>
              <button
                type="submit"
                disabled={submitting || loading}
                className="btn-primary w-full"
              >
                {submitting ? "Signing in…" : "Sign in"}
              </button>
              <div className="space-y-2 border-t border-neutral-200 pt-4 text-xs text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
                <p>
                  <span className="font-medium text-neutral-800 dark:text-neutral-200">
                    Admin:
                  </span>{" "}
                  use the email and password from <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">BOOTSTRAP_ADMIN_*</code> in{" "}
                  <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">backend/.env</code>{" "}
                  (or the account you created first).
                </p>
                <p>
                  <span className="font-medium text-neutral-800 dark:text-neutral-200">
                    Workspace user:
                  </span>{" "}
                  an admin must create your user under a workspace in{" "}
                  <strong>Team users</strong>; then use that email and password here.
                </p>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
