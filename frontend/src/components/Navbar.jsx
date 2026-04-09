import { useAuth } from "../hooks/useAuth";
import ThemeToggle from "./ThemeToggle";

export default function Navbar({ title, showThemeToggle = true }) {
  const { email, logout } = useAuth();

  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
      <div className="flex h-14 items-center justify-between gap-3 px-4 lg:px-8">
        <h1 className="truncate text-base font-semibold text-neutral-900 dark:text-neutral-100 lg:text-lg">
          {title}
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          {showThemeToggle && <ThemeToggle />}
          <span className="hidden max-w-[200px] truncate text-sm text-neutral-500 dark:text-neutral-400 sm:inline">
            {email}
          </span>
          <button
            type="button"
            onClick={logout}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-900 transition hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-100 dark:hover:bg-neutral-900"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
