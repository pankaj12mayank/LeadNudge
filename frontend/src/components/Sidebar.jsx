import { NavLink } from "react-router-dom";
import { mediaUrl } from "../utils/mediaUrl";

const adminLinks = [
  { to: "/admin/dashboard", label: "Overview" },
  { to: "/admin/workspaces", label: "Workspaces" },
  { to: "/admin/users", label: "Team users" },
  { to: "/admin/ai-settings", label: "AI configuration" },
  { to: "/admin/usage", label: "Usage" },
  { to: "/admin/account", label: "Account & branding" },
];

const userLinks = [
  { to: "/dashboard", label: "Overview" },
  { to: "/leads", label: "Leads" },
  { to: "/followups", label: "Follow-ups" },
  { to: "/email-settings", label: "Email (SMTP)" },
  { to: "/profile", label: "Profile" },
];

function linkClass({ isActive }) {
  return `block rounded-md px-3 py-2 text-sm font-medium transition ${
    isActive
      ? "bg-neutral-900 text-white dark:bg-white dark:text-black"
      : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
  }`;
}

function brandInitials(name) {
  const t = (name || "").trim();
  if (!t) return "SF";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Sidebar({
  variant,
  projectName,
  logoUrl,
  supportEmail,
}) {
  const links = variant === "admin" ? adminLinks : userLinks;
  const home = variant === "admin" ? "/admin/dashboard" : "/dashboard";
  const displayName = projectName || "Sales Follow-up Console";
  const imgSrc = mediaUrl(logoUrl);

  return (
    <aside className="relative hidden w-60 shrink-0 flex-col border-r border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950 lg:flex">
      <div className="flex min-h-14 flex-col gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <NavLink
          to={home}
          className="flex items-center gap-3 font-semibold text-neutral-900 dark:text-neutral-100"
        >
          {imgSrc ? (
            <img
              src={imgSrc}
              alt=""
              className="h-9 w-9 shrink-0 rounded object-contain grayscale contrast-125 dark:invert dark:contrast-100"
            />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-neutral-300 text-xs font-bold dark:border-neutral-600">
              {brandInitials(displayName)}
            </span>
          )}
          <span className="line-clamp-2 text-sm leading-tight">{displayName}</span>
        </NavLink>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} className={linkClass} end={l.to === home}>
            {l.label}
          </NavLink>
        ))}
        {variant === "user" && supportEmail ? (
          <a
            href={`mailto:${supportEmail}`}
            className="block rounded-md px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
          >
            Support
          </a>
        ) : null}
      </nav>
    </aside>
  );
}

export function MobileNav({
  variant,
  open,
  onClose,
  projectName,
  logoUrl,
  supportEmail,
}) {
  const links = variant === "admin" ? adminLinks : userLinks;
  const home = variant === "admin" ? "/admin/dashboard" : "/dashboard";
  const displayName = projectName || "Sales Follow-up Console";
  const imgSrc = mediaUrl(logoUrl);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 dark:bg-black/70"
        aria-label="Close menu"
        onClick={onClose}
      />
      <div className="absolute left-0 top-0 flex h-full w-[min(100%,20rem)] flex-col border-r border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          {imgSrc ? (
            <img
              src={imgSrc}
              alt=""
              className="h-8 w-8 rounded object-contain grayscale contrast-125 dark:invert"
            />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded border border-neutral-300 text-xs font-bold dark:border-neutral-600">
              {brandInitials(displayName)}
            </span>
          )}
          <NavLink
            to={home}
            className="font-semibold text-neutral-900 dark:text-neutral-100"
            onClick={onClose}
          >
            {displayName}
          </NavLink>
        </div>
        <nav className="space-y-0.5 overflow-y-auto p-3">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={linkClass}
              onClick={onClose}
              end={l.to === home}
            >
              {l.label}
            </NavLink>
          ))}
          {variant === "user" && supportEmail ? (
            <a
              href={`mailto:${supportEmail}`}
              className="block rounded-md px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
              onClick={onClose}
            >
              Support
            </a>
          ) : null}
        </nav>
      </div>
    </div>
  );
}
