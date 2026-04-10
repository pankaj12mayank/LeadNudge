import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import Card from "../../components/Card";
import Table from "../../components/Table";
import Badge from "../../components/Badge";
import PaginationBar from "../../components/PaginationBar";
import PasswordField from "../../components/PasswordField";
import * as adminService from "../../services/adminService";
import { workspaceLabel } from "../../utils/workspaceLabel";

function planLabel(t) {
  return t === "pro" ? "Paid (Pro)" : "Free";
}

export default function Users() {
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [plan, setPlan] = useState("free");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [listLoading, setListLoading] = useState(false);

  const wsById = useMemo(() => {
    const m = {};
    workspaces.forEach((w) => {
      m[w.id] = w;
    });
    return m;
  }, [workspaces]);

  async function loadUsers() {
    setListLoading(true);
    try {
      const u = await adminService.listUsers(undefined, {
        page,
        limit,
        q: appliedQ || undefined,
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
  }, [page, limit, appliedQ]);

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
    { key: "id", label: "ID" },
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
      key: "is_active",
      label: "Access",
      render: (r) => (
        <Badge variant={r.is_active ? "solid" : "outline"}>
          {r.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <div className="flex flex-wrap gap-2">
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
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-8 p-4 lg:p-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Access control
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Team users
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
          Invite people to the Free or Pro workspace. You can deactivate access or
          remove a user at any time.
        </p>
      </div>

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
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label className="form-label">Search</label>
            <input
              className="form-input w-full"
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
          </div>
          <button
            type="button"
            className="btn-secondary w-full sm:w-auto"
            onClick={() => {
              setAppliedQ(searchQ.trim());
              setPage(1);
            }}
          >
            Search
          </button>
        </div>
        {loading ? (
          <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
        ) : (
          <>
            <Table
              columns={columns}
              rows={usersRes.items}
              emptyText="No users yet"
            />
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
    </div>
  );
}
