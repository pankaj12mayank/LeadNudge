import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import Card from "../../components/Card";
import Table from "../../components/Table";
import Badge from "../../components/Badge";
import PaginationBar from "../../components/PaginationBar";
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
      const u = await adminService.listUsers(undefined, { page, limit });
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
        const u = await adminService.listUsers(undefined, { page, limit });
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
  }, [page, limit]);

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
  ];

  return (
    <div className="space-y-8 p-4 lg:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Team users
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
          There are exactly two workspaces: <strong>Free</strong> and <strong>Pro</strong>. When you
          create a user, choose which plan workspace they join. They sign in on the same page as you
          with their email and password.
        </p>
      </div>

      <Card title="Invite workspace user">
        <form onSubmit={onCreate} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="form-label">User email</label>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={saving}
                placeholder="colleague@company.com"
                required
              />
            </div>
            <div>
              <label className="form-label">Initial password</label>
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={saving}
                placeholder="Min 6 characters"
                minLength={6}
                required
              />
            </div>
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
          <button type="submit" disabled={saving} className="btn-primary">
            Create user
          </button>
        </form>
      </Card>

      <Card title="All users">
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
