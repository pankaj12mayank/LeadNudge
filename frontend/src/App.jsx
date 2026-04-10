import { useEffect, useState } from "react";
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import Navbar from "./components/Navbar";
import Sidebar, { MobileNav, SidebarExpandButton } from "./components/Sidebar";
import ProtectedRoute from "./components/ProtectedRoute";
import { useSite } from "./context/SiteContext";
import Login from "./pages/auth/Login";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminAccount from "./pages/admin/AdminAccount";
import Workspaces from "./pages/admin/Workspaces";
import Users from "./pages/admin/Users";
import AISettings from "./pages/admin/AISettings";
import Usage from "./pages/admin/Usage";
import Dashboard from "./pages/user/Dashboard";
import Leads from "./pages/user/Leads";
import Followups from "./pages/user/Followups";
import EmailSettings from "./pages/user/EmailSettings";
import Profile from "./pages/user/Profile";

const NAV_TITLES = {
  "/admin/dashboard": "Overview",
  "/admin/workspaces": "Workspaces",
  "/admin/users": "Team users",
  "/admin/ai-settings": "AI configuration",
  "/admin/usage": "Usage",
  "/admin/account": "Account & branding",
  "/dashboard": "Overview",
  "/leads": "Leads",
  "/followups": "Follow-ups",
  "/email-settings": "Email (SMTP)",
  "/profile": "Profile",
};

const SIDEBAR_KEY = "ais_sidebar_collapsed";

function Shell({ variant }) {
  const { pathname } = useLocation();
  const { site } = useSite();
  const navTitle =
    NAV_TITLES[pathname] || (variant === "admin" ? "Admin" : "Workspace");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_KEY) === "1",
  );

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed ? "1" : "0");
  }, [sidebarCollapsed]);

  const projectName = site?.project_name;
  const logoUrl = site?.logo_url;
  const supportEmail = site?.support_email;

  return (
    <div className="flex min-h-screen w-full bg-neutral-50 dark:bg-black">
      <Sidebar
        variant={variant}
        projectName={projectName}
        logoUrl={logoUrl}
        supportEmail={supportEmail}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
      />
      {sidebarCollapsed ? (
        <SidebarExpandButton onClick={() => setSidebarCollapsed(false)} />
      ) : null}
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
        <main className="flex-1 overflow-auto">
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
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
        <Route element={<Shell variant="admin" />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/workspaces" element={<Workspaces />} />
          <Route path="/admin/users" element={<Users />} />
          <Route path="/admin/ai-settings" element={<AISettings />} />
          <Route path="/admin/usage" element={<Usage />} />
          <Route path="/admin/account" element={<AdminAccount />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={["user"]} />}>
        <Route element={<Shell variant="user" />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/followups" element={<Followups />} />
          <Route path="/email-settings" element={<EmailSettings />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
