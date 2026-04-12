import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import Card from "../../components/Card";
import Table from "../../components/Table";
import Badge from "../../components/Badge";
import PaginationBar from "../../components/PaginationBar";
import PasswordField from "../../components/PasswordField";
import * as adminService from "../../services/adminService";
import { workspaceLabel } from "../../utils/workspaceLabel";

/** Defaults must match backend `admin_service.FREE_PLAN_AI_LIMIT` / `PRO_PLAN_AI_LIMIT`. */
const DEFAULT_AI_LIMIT_FREE = 200;
const DEFAULT_AI_LIMIT_PRO = 10_000;

function planLabel(t) {
  return t === "pro" ? "Paid (Pro)" : "Free";
}

export default function Users() {
  const location = useLocation();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const limit = 20;
  const [workspaces, setWorkspaces] = useState([]);
  const [usersRes, setUsersRes] = useState({
    items: [],
    total: 0,
    pages: 1,
  });
  const [searchQ, setSearchQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [plan, setPlan] = useState("free");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [pwUser, setPwUser] = useState(null);
  const [newPw, setNewPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [limitRow, setLimitRow] = useState(null);
  const [limitInput, setLimitInput] = useState("");
  const [limitSaving, setLimitSaving] = useState(false);
  const [adminEmailNorm, setAdminEmailNorm] = useState("");

  const wsById = useMemo(() => {
    const m = {};
    workspaces.forEach((w) => {
      m[w.id] = w;
    });
    return m;
  }, [workspaces]);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const me = await adminService.getAdminMe();
        if (!c) {
          setAdminEmailNorm(String(me.email || "").trim().toLowerCase());
        }
      } catch {
        if (!c) setAdminEmailNorm("");
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  async function loadUsers() {
    setListLoading(true);
    try {
      const u = await adminService.listUsers(undefined, {
        page,
        limit,
        q: appliedQ || undefined,
        plan: planFilter || undefined,
        status: statusFilter || undefined,
      });
      setUsersRes({
        items: u.items ?? [],
        total: u.total ?? 0,
        pages: u.pages ?? 1,
      });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    let c = false;
    (async () => {
      setLoading(true);
      setListLoading(true);
      try {
        const ws = await adminService.listWorkspaces();
        if (!c) setWorkspaces(ws);
        const u = await adminService.listUsers(undefined, {
          page,
          limit,
          q: appliedQ || undefined,
          plan: planFilter || undefined,
          status: statusFilter || undefined,
        });
        if (!c) {
          setUsersRes({
            items: u.items ?? [],
            total: u.total ?? 0,
            pages: u.pages ?? 1,
          });
        }
      } catch (e) {
        if (!c) toast.error(e.message);
      } finally {
        if (!c) {
          setLoading(false);
          setListLoading(false);
        }
      }
    })();
    return () => {
      c = true;
    };
  }, [page, limit, appliedQ, planFilter, statusFilter]);

  useEffect(() => {
    const preset = location.state?.presetSearch;
    if (typeof preset === "string" && preset.trim()) {
      setSearchQ(preset.trim());
      setAppliedQ(preset.trim());
      setPage(1);
      navigate("/admin/users", { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  async function onCreate(e) {
    e.preventDefault();
    if (!email.trim() || password.length < 6) {
      toast.warning("Valid email and password (min 6 characters) required.");
      return;
    }
    setSaving(true);
    try {
      await adminService.createUser({
        email: email.trim(),
        password,
        plan,
      });
      setEmail("");
      setPassword("");
      toast.success("User created");
      await loadUsers();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row) {
    try {
      await adminService.patchUser(row.id, { is_active: !row.is_active });
      toast.success(row.is_active ? "User deactivated" : "User activated");
      await loadUsers();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function removeUser(row) {
    if (!confirm(`Remove ${row.email}? This cannot be undone.`)) return;
    try {
      await adminService.deleteUser(row.id);
      toast.success("User removed");
      await loadUsers();
    } catch (e) {
      toast.error(e.message);
    }
  }

  const columns = [
    { key: "id", label: "#" },
    { key: "email", label: "Email" },
    {
      key: "workspace_id",
      label: "Workspace",
      render: (r) => {
        const w = wsById[r.workspace_id];
        return w ? workspaceLabel(w.name) : `#${r.workspace_id}`;
      },
    },
    {
      key: "plan",
      label: "Plan",
      render: (r) => {
        const w = wsById[r.workspace_id];
        const t = w?.plan_type ?? "free";
        return (
          <Badge variant={t === "pro" ? "solid" : "muted"}>{planLabel(t)}</Badge>
        );
      },
    },
    {
      key: "pool_switch",
      label: "Pool",
      render: (r) => {
        const cur = (r.workspace_plan_type ?? "free").toLowerCase();
        const isSelf =
          (r.email || "").trim().toLowerCase() === adminEmailNorm;
        return (
          <select
            className="form-select max-w-[7rem] text-xs"
            value={cur}
            disabled={isSelf}
            title={
              isSelf
                ? "You cannot change pool for the admin sign-in identity."
                : "Move user between Free and Pro workspace pools"
            }
            onChange={async (e) => {
              const v = e.target.value;
              if (v === cur) return;
              try {
                await adminService.patchUser(r.id, { plan: v });
                toast.success("User moved to the selected pool.");
                await loadUsers();
              } catch (err) {
                toast.error(err.message);
              }
            }}
          >
            <option value="free">Free</option>
            <option value="pro">Pro</option>
          </select>
        );
      },
    },
    {
      key: "is_active",
      label: "Access",
      render: (r) => (
        <Badge variant={r.is_active ? "solid" : "outline"}>
          {r.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "ai_quota",
      label: "AI quota (workspace)",
      render: (r) => (
        <div className="flex max-w-[11rem] flex-col gap-1 text-xs">
          <span className="text-neutral-700 dark:text-neutral-300">
            {(r.workspace_ai_used ?? 0).toLocaleString()} /{" "}
            {(r.workspace_ai_limit ?? 0).toLocaleString()} msgs
          </span>
          {r.workspace_ai_quota_exhausted ? (
            <Badge variant="hot">At limit</Badge>
          ) : null}
          <button
            type="button"
            className="w-fit text-left font-medium text-blue-700 underline decoration-blue-300 underline-offset-2 dark:text-blue-400"
            onClick={() => {
              setLimitRow(r);
              setLimitInput(String(r.workspace_ai_limit ?? 0));
            }}
          >
            Set workspace limit
          </button>
        </div>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (r) => {
        const isSelf =
          (r.email || "").trim().toLowerCase() === adminEmailNorm;
        return (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="text-xs font-medium text-blue-700 underline decoration-blue-300 underline-offset-2 dark:text-blue-400"
              onClick={() => {
                setPwUser(r);
                setNewPw("");
              }}
            >
              Set password
            </button>
            {!isSelf ? (
              <>
                <button
                  type="button"
                  className="text-xs font-medium underline decoration-neutral-400 underline-offset-2"
                  onClick={() => toggleActive(r)}
                >
                  {r.is_active ? "Deactivate" : "Activate"}
                </button>
                <button
                  type="button"
                  className="text-xs font-medium text-red-700 underline decoration-red-300 underline-offset-2 dark:text-red-400"
                  onClick={() => removeUser(r)}
                >
                  Delete
                </button>
              </>
            ) : (
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                Admin account
              </span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="w-full space-y-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="w-full border-b border-neutral-200 pb-6 dark:border-neutral-800">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Access control
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Invites, access &amp; removal
        </h1>
        <p className="mt-2 w-full text-sm text-neutral-600 dark:text-neutral-400">
          Invite people to the Free or Pro workspace. Use <strong>Set password</strong> when a user
          requested help from the sign-in page — they are emailed the new password if SMTP is set up.
          AI message limits are per <strong>workspace</strong>; when the limit is reached, users stay
          signed in but cannot schedule new AI follow-ups until you raise the limit (or change the pool
          plan under Workspaces). Changing a limit here updates the user dashboard usage immediately.
        </p>
      </section>

      <Card title="Invite user">
        <form onSubmit={onCreate} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="form-label">User email</label>
              <input
                type="email"
                className="form-input w-full"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={saving}
                placeholder="colleague@company.com"
                required
              />
            </div>
            <PasswordField
              label="Initial password"
              className="form-input w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={saving}
              autoComplete="new-password"
              placeholder="Min 6 characters"
            />
            <div className="sm:col-span-2">
              <span className="form-label">Workspace plan</span>
              <div className="mt-2 flex flex-wrap gap-4">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="plan"
                    checked={plan === "free"}
                    onChange={() => setPlan("free")}
                    disabled={saving}
                  />
                  <span className="text-sm text-neutral-800 dark:text-neutral-200">
                    Free workspace
                  </span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="plan"
                    checked={plan === "pro"}
                    onChange={() => setPlan("pro")}
                    disabled={saving}
                  />
                  <span className="text-sm text-neutral-800 dark:text-neutral-200">
                    Pro workspace
                  </span>
                </label>
              </div>
            </div>
          </div>
          <button type="submit" disabled={saving} className="btn-primary w-full sm:w-auto">
            Create user
          </button>
        </form>
      </Card>

      <Card title="All users">
        <div className="mb-4 flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="form-label">Plan type</label>
              <select
                className="form-select w-full"
                value={planFilter}
                onChange={(e) => {
                  setPlanFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All plans</option>
                <option value="free">Free</option>
                <option value="pro">Pro</option>
              </select>
            </div>
            <div>
              <label className="form-label">Status</label>
              <select
                className="form-select w-full"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-2">
              <label className="form-label">Search</label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                <input
                  className="form-input min-w-0 flex-1"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Email or name"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setAppliedQ(searchQ.trim());
                      setPage(1);
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn-secondary shrink-0"
                  onClick={() => {
                    setAppliedQ(searchQ.trim());
                    setPage(1);
                  }}
                >
                  Search
                </button>
              </div>
            </div>
          </div>
        </div>
        {loading ? (
          <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
        ) : (
          <>
            <div className="w-full overflow-x-auto">
              <Table
                columns={columns}
                rows={usersRes.items}
                emptyText="No users yet"
              />
            </div>
            <PaginationBar
              page={page}
              pages={usersRes.pages}
              total={usersRes.total}
              limit={limit}
              disabled={listLoading}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      {limitRow ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <Card
            title="Workspace AI message limit"
            className="relative z-10 w-full max-w-md shadow-xl"
          >
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Applies to everyone in{" "}
              <strong>
                {workspaceLabel(wsById[limitRow.workspace_id]?.name) || `workspace #${limitRow.workspace_id}`}
              </strong>
              . Current usage: {(limitRow.workspace_ai_used ?? 0).toLocaleString()} messages sent
              (unchanged when you only change the cap).
            </p>
            <div className="mt-4">
              <label className="form-label">New limit (messages)</label>
              <input
                type="number"
                min={0}
                className="form-input w-full"
                value={limitInput}
                onChange={(e) => setLimitInput(e.target.value)}
                disabled={limitSaving}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary text-xs"
                disabled={limitSaving}
                onClick={() => setLimitInput(String(DEFAULT_AI_LIMIT_FREE))}
              >
                Free default ({DEFAULT_AI_LIMIT_FREE.toLocaleString()})
              </button>
              <button
                type="button"
                className="btn-secondary text-xs"
                disabled={limitSaving}
                onClick={() => setLimitInput(String(DEFAULT_AI_LIMIT_PRO))}
              >
                Pro default ({DEFAULT_AI_LIMIT_PRO.toLocaleString()})
              </button>
            </div>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="btn-secondary w-full sm:w-auto"
                disabled={limitSaving}
                onClick={() => {
                  setLimitRow(null);
                  setLimitInput("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary w-full sm:w-auto"
                disabled={limitSaving}
                onClick={async () => {
                  const n = Number.parseInt(limitInput, 10);
                  if (!Number.isFinite(n) || n < 0) {
                    toast.warning("Enter a valid non-negative number.");
                    return;
                  }
                  setLimitSaving(true);
                  try {
                    await adminService.updateAdminSettings({
                      workspace_id: limitRow.workspace_id,
                      usage_limit: n,
                    });
                    toast.success("AI message limit updated. Users see new cap on refresh.");
                    setLimitRow(null);
                    setLimitInput("");
                    await loadUsers();
                  } catch (e) {
                    toast.error(e.message);
                  } finally {
                    setLimitSaving(false);
                  }
                }}
              >
                {limitSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </Card>
        </div>
      ) : null}

      {pwUser ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <Card title={`New password — ${pwUser.email}`} className="w-full max-w-md shadow-xl">
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (newPw.length < 6) {
                  toast.warning("Password must be at least 6 characters.");
                  return;
                }
                setPwSaving(true);
                try {
                  await adminService.setUserPassword(pwUser.id, newPw);
                  toast.success("Password updated. User was emailed if SMTP is configured.");
                  setPwUser(null);
                  setNewPw("");
                  await loadUsers();
                } catch (err) {
                  toast.error(err.message);
                } finally {
                  setPwSaving(false);
                }
              }}
            >
              <PasswordField
                label="New password"
                className="form-input w-full"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                disabled={pwSaving}
                autoComplete="new-password"
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  className="btn-secondary w-full sm:w-auto"
                  disabled={pwSaving}
                  onClick={() => {
                    setPwUser(null);
                    setNewPw("");
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary w-full sm:w-auto" disabled={pwSaving}>
                  {pwSaving ? "Saving…" : "Save & notify"}
                </button>
              </div>
            </form>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
