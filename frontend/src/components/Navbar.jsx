import { useAuth } from "../hooks/useAuth";
import ThemeToggle from "./ThemeToggle";

export default function Navbar({ title, showThemeToggle = true }) {
  const { email, displayName, role, requestLogout } = useAuth();

  const label =
    (displayName && displayName.trim()) ||
    (role === "admin" ? "Admin" : "User");

  return (
    <header className="sticky top-0 z-20 w-full border-b border-neutral-200 bg-white/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
      <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center justify-between gap-3 px-4 lg:px-8">
        <h1 className="min-w-0 truncate text-base font-semibold text-neutral-900 dark:text-neutral-100 lg:text-lg">
          {title}
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          {showThemeToggle && <ThemeToggle />}
          <span
            className="hidden max-w-[min(200px,40vw)] truncate text-sm text-neutral-600 dark:text-neutral-300 sm:inline"
            title={email || ""}
          >
            {label}
          </span>
          <button
            type="button"
            onClick={requestLogout}
            className="w-full min-w-[5rem] rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-900 transition hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-100 dark:hover:bg-neutral-900 sm:w-auto"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
