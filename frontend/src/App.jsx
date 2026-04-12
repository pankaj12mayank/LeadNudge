import { useState } from "react";
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import Navbar from "./components/Navbar";
import Sidebar, { MobileNav } from "./components/Sidebar";
import ProtectedRoute from "./components/ProtectedRoute";
import { useSite } from "./context/SiteContext";
import Login from "./pages/auth/Login";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminAccount from "./pages/admin/AdminAccount";
import Workspaces from "./pages/admin/Workspaces";
import Users from "./pages/admin/Users";
import AISettings from "./pages/admin/AISettings";
import Usage from "./pages/admin/Usage";
import UsageHistory from "./pages/admin/UsageHistory";
import AdminLogs from "./pages/admin/AdminLogs";
import PasswordRequests from "./pages/admin/PasswordRequests";
import EmailTemplates from "./pages/admin/EmailTemplates";
import EmailTemplateCreate from "./pages/admin/EmailTemplateCreate";
import EmailTemplateEdit from "./pages/admin/EmailTemplateEdit";
import Dashboard from "./pages/user/Dashboard";
import UsageActivity from "./pages/user/UsageActivity";
import Leads from "./pages/user/Leads";
import Followups from "./pages/user/Followups";
import SentMails from "./pages/user/SentMails";
import EmailSettings from "./pages/user/EmailSettings";
import Profile from "./pages/user/Profile";
import FollowupReminderListener from "./components/FollowupReminderListener";
import UsageLimitBanner from "./components/UsageLimitBanner";

/** Short labels for the top header (each page hero title is different, set in the page). */
const NAV_TITLES = {
  "/admin/dashboard": "Overview",
  "/admin/workspaces": "Workspaces",
  "/admin/users": "Team",
  "/admin/password-requests": "Password requests",
  "/admin/email-templates": "Email templates",
  "/admin/ai-settings": "AI setup",
  "/admin/usage": "Usage",
  "/admin/usage-history": "Usage history",
  "/admin/logs": "Logs",
  "/admin/account": "Branding",
  "/dashboard": "Overview",
  "/usage-activity": "Activity",
  "/leads": "Leads",
  "/followups": "Follow-ups",
  "/sent-mails": "Sent mail",
  "/email-settings": "Email",
  "/profile": "Profile",
};

function headerTitle(pathname, variant) {
  if (pathname === "/admin/email-templates/new") {
    return "Add template";
  }
  if (
    pathname.startsWith("/admin/email-templates/") &&
    pathname !== "/admin/email-templates"
  ) {
    return "Email template";
  }
  return NAV_TITLES[pathname] || (variant === "admin" ? "Admin" : "Workspace");
}

function Shell({ variant }) {
  const { pathname } = useLocation();
  const { site } = useSite();
  const navTitle = headerTitle(pathname, variant);
  const [mobileOpen, setMobileOpen] = useState(false);

  const projectName = site?.project_name;
  const logoUrl = site?.logo_url;
  const supportEmail = site?.support_email;

  return (
    <div className="flex min-h-screen w-full bg-neutral-50 dark:bg-black">
      {variant === "user" ? <FollowupReminderListener /> : null}
      <Sidebar
        variant={variant}
        projectName={projectName}
        logoUrl={logoUrl}
        supportEmail={supportEmail}
      />
      <MobileNav
        variant={variant}
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        projectName={projectName}
        logoUrl={logoUrl}
        supportEmail={supportEmail}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-neutral-200 bg-white px-2 dark:border-neutral-800 dark:bg-neutral-950 lg:hidden">
          <button
            type="button"
            className="rounded-md p-2 text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>
        <Navbar title={navTitle} />
        {variant === "user" ? <UsageLimitBanner /> : null}
        <main className="flex-1 w-full min-w-0 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
        <Route element={<Shell variant="admin" />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/workspaces" element={<Workspaces />} />
          <Route path="/admin/users" element={<Users />} />
          <Route path="/admin/password-requests" element={<PasswordRequests />} />
          <Route path="/admin/email-templates" element={<EmailTemplates />} />
          <Route path="/admin/email-templates/new" element={<EmailTemplateCreate />} />
          <Route
            path="/admin/email-templates/:templateName"
            element={<EmailTemplateEdit />}
          />
          <Route path="/admin/ai-settings" element={<AISettings />} />
          <Route path="/admin/usage" element={<Usage />} />
          <Route path="/admin/usage-history" element={<UsageHistory />} />
          <Route path="/admin/logs" element={<AdminLogs />} />
          <Route path="/admin/account" element={<AdminAccount />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={["user"]} />}>
        <Route element={<Shell variant="user" />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/usage-activity" element={<UsageActivity />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/followups" element={<Followups />} />
          <Route path="/sent-mails" element={<SentMails />} />
          <Route path="/email-settings" element={<EmailSettings />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
