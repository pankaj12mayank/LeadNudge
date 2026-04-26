import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import Card from "../../components/Card";
import Table from "../../components/Table";
import Badge from "../../components/Badge";
import PaginationBar from "../../components/PaginationBar";
import * as adminService from "../../services/adminService";
import * as userService from "../../services/userService";
import { workspaceLabel } from "../../utils/workspaceLabel";
import {
  leadStatusBadgeVariant,
  leadStatusLabel,
} from "../../utils/leadPipeline";

export default function AdminLeads() {
  const [page, setPage] = useState(1);
  const limit = 25;
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceFilter, setWorkspaceFilter] = useState("");
  const [leadOwnerFilter, setLeadOwnerFilter] = useState("");
  const [workspaceUsers, setWorkspaceUsers] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);
  /** @type {Record<string, string>} */
  const [mergeLabelByKey, setMergeLabelByKey] = useState({});

  const wsById = useMemo(() => {
    const m = {};
    (workspaces || []).forEach((w) => {
      m[w.id] = w;
    });
    return m;
  }, [workspaces]);

  const idsOnPage = useMemo(() => new Set(rows.map((r) => r.id)), [rows]);
  const allOnPageSelected =
    idsOnPage.size > 0 && [...idsOnPage].every((id) => selectedIds.has(id));

  const columns = useMemo(
    () => [
      {
        key: "_sel",
        label: "",
        render: (r) => (
          <input
            type="checkbox"
            checked={selectedIds.has(r.id)}
            onChange={(e) => {
              const next = new Set(selectedIds);
              if (e.target.checked) next.add(r.id);
              else next.delete(r.id);
              setSelectedIds(next);
            }}
            aria-label={`Select lead ${r.id}`}
          />
        ),
      },
      {
        key: "id",
        label: "ID",
        render: (r) => <span className="font-mono text-xs">{r.id}</span>,
      },
      {
        key: "workspace",
        label: "Workspace",
        render: (r) => {
          const ws = wsById[r.workspace_id];
          return (
            <span className="max-w-[10rem] truncate text-sm">
              {ws ? workspaceLabel(ws.name) : `#${r.workspace_id}`}
            </span>
          );
        },
      },
      {
        key: "owner_user_id",
        label: "Owner user",
        render: (r) => (
          <span className="font-mono text-xs">
            {r.owner_user_id != null ? r.owner_user_id : "—"}
          </span>
        ),
      },
      { key: "name", label: "Name", render: (r) => <span className="text-sm">{r.name}</span> },
      {
        key: "company",
        label: albl("company", "Company"),
        render: (r) => (
          <span className="max-w-[8rem] truncate text-xs">{r.company || "—"}</span>
        ),
      },
      {
        key: "role_title",
        label: albl("role_title", "Role"),
        render: (r) => (
          <span className="max-w-[6rem] truncate text-xs">{r.role_title || "—"}</span>
        ),
      },
      {
        key: "lead_type",
        label: "Lead type",
        render: (r) => (
          <span className="text-xs font-medium tabular-nums">{r.lead_type || "—"}</span>
        ),
      },
      {
        key: "problem_seen",
        label: albl("problem_seen", "Problem seen"),
        render: (r) => (
          <span className="line-clamp-2 max-w-[8rem] text-xs text-neutral-600 dark:text-neutral-400">
            {r.problem_seen || "—"}
          </span>
        ),
      },
      {
        key: "solution",
        label: albl("solution", "Solution"),
        render: (r) => (
          <span className="line-clamp-2 max-w-[8rem] text-xs text-neutral-600 dark:text-neutral-400">
            {r.solution || "—"}
          </span>
        ),
      },
      {
        key: "agency_type",
        label: "Agency",
        render: (r) => (
          <span className="max-w-[6rem] truncate text-xs">{r.agency_type || "—"}</span>
        ),
      },
      { key: "email", label: "Email", render: (r) => <span className="text-sm">{r.email}</span> },
      {
        key: "status",
        label: "Status",
        render: (r) => (
          <Badge variant={leadStatusBadgeVariant(r.status)}>
            {leadStatusLabel(r.status)}
          </Badge>
        ),
      },
      {
        key: "temperature_tag",
        label: "Temp",
        render: (r) => (
          <span className="text-xs text-neutral-600 dark:text-neutral-400">
            {r.temperature_tag || "—"}
          </span>
        ),
      },
    ],
    [wsById, selectedIds, mergeLabelByKey],
  );

  function apiErrorMessage(e) {
    const d = e?.response?.data?.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) return d.map((x) => x?.msg ?? x).join("; ");
    return e?.message ?? "Request failed";
  }

  const workspaceIdParam = useMemo(() => {
    if (workspaceFilter === "") return undefined;
    const n = Number(workspaceFilter);
    return Number.isFinite(n) ? n : undefined;
  }, [workspaceFilter]);

  const leadOwnerIdParam = useMemo(() => {
    if (leadOwnerFilter === "" || workspaceIdParam == null) return undefined;
    const n = Number(leadOwnerFilter);
    return Number.isFinite(n) ? n : undefined;
  }, [leadOwnerFilter, workspaceIdParam]);

  useEffect(() => {
    let c = false;
    adminService
      .listWorkspaces()
      .then((data) => {
        if (!c) setWorkspaces(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!c) setWorkspaces([]);
      });
    return () => {
      c = true;
    };
  }, []);

  useEffect(() => {
    if (workspaceIdParam == null) {
      setWorkspaceUsers([]);
      setLeadOwnerFilter("");
      return;
    }
    let c = false;
    adminService
      .listUsers(workspaceIdParam, { limit: 200, page: 1 })
      .then((data) => {
        if (!c) setWorkspaceUsers(data?.items ?? []);
      })
      .catch(() => {
        if (!c) setWorkspaceUsers([]);
      });
    return () => {
      c = true;
    };
  }, [workspaceIdParam]);

  useEffect(() => {
    let c = false;
    (async () => {
      setListLoading(true);
      try {
        const data = await userService.listLeads(workspaceIdParam, {
          page,
          limit,
          q: searchQ || undefined,
          lead_owner_id: leadOwnerIdParam,
        });
        if (!c) {
          setRows(data.items ?? []);
          setTotal(data.total ?? 0);
          setPages(data.pages ?? 1);
        }
      } catch (e) {
        if (!c) toast.error(apiErrorMessage(e));
      } finally {
        if (!c) {
          setListLoading(false);
          setLoading(false);
        }
      }
    })();
    return () => {
      c = true;
    };
  }, [page, limit, workspaceIdParam, searchQ, leadOwnerIdParam]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, searchQ, workspaceIdParam, leadOwnerIdParam]);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const wid =
          workspaceFilter === "" || workspaceFilter == null
            ? undefined
            : Number(workspaceFilter);
        const d = await adminService.getLeadMergeFields(wid);
        if (c) return;
        const m = {};
        (d.resolved || []).forEach((f) => {
          m[f.key] = f.label;
        });
        setMergeLabelByKey(m);
      } catch {
        if (!c) setMergeLabelByKey({});
      }
    })();
    return () => {
      c = true;
    };
  }, [workspaceFilter]);

  function albl(key, fallback) {
    return mergeLabelByKey[key] || fallback;
  }

  async function onDeleteSelected() {
    const ids = [...selectedIds];
    if (!ids.length) {
      toast.warning("Select at least one lead.");
      return;
    }
    if (
      !confirm(
        `Delete ${ids.length} lead(s)? Follow-ups and messages for those leads will be removed.`,
      )
    )
      return;
    setBatchDeleting(true);
    try {
      const { deleted } = await userService.deleteLeadsBatch(ids);
      toast.success(
        deleted ? `Deleted ${deleted} lead(s).` : "No matching leads to delete.",
      );
      setSelectedIds(new Set());
      const data = await userService.listLeads(workspaceIdParam, {
        page,
        limit,
        q: searchQ || undefined,
        lead_owner_id: leadOwnerIdParam,
      });
      setRows(data.items ?? []);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBatchDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          All leads
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Every lead in every workspace. Filter by workspace, optional team member (owner), search,
          then multi-select and delete.
        </p>
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-neutral-200 p-4 dark:border-neutral-800 md:flex-row md:flex-wrap md:items-end">
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
            <span className="text-neutral-600 dark:text-neutral-400">
              Workspace
            </span>
            <select
              className="rounded-md border border-neutral-300 bg-white px-2 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
              value={workspaceFilter}
              onChange={(e) => {
                setPage(1);
                setWorkspaceFilter(e.target.value);
                setLeadOwnerFilter("");
              }}
            >
              <option value="">All workspaces</option>
              {(workspaces || []).map((w) => (
                <option key={w.id} value={String(w.id)}>
                  {workspaceLabel(w.name)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
            <span className="text-neutral-600 dark:text-neutral-400">
              Leads owned by user
            </span>
            <select
              className="rounded-md border border-neutral-300 bg-white px-2 py-2 text-sm disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-950"
              value={leadOwnerFilter}
              disabled={workspaceIdParam == null}
              onChange={(e) => {
                setPage(1);
                setLeadOwnerFilter(e.target.value);
              }}
            >
              <option value="">All users in workspace</option>
              {(workspaceUsers || []).map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.email}
                  {u.display_name ? ` (${u.display_name})` : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
            <span className="text-neutral-600 dark:text-neutral-400">
              Search
            </span>
            <div className="flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-2 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-950"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Name or email"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setPage(1);
                    setSearchQ(searchInput.trim());
                  }
                }}
              />
              <button
                type="button"
                className="shrink-0 rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
                onClick={() => {
                  setPage(1);
                  setSearchQ(searchInput.trim());
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium dark:border-neutral-600 dark:bg-neutral-950"
            disabled={loading || listLoading || idsOnPage.size === 0}
            onClick={() => {
              if (allOnPageSelected) setSelectedIds(new Set());
              else setSelectedIds(new Set(idsOnPage));
            }}
          >
            {allOnPageSelected ? "Clear page selection" : "Select all on page"}
          </button>
          <button
            type="button"
            className="rounded-md border border-red-400 bg-red-50 px-3 py-2 text-sm font-medium text-red-950 hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100 dark:hover:bg-red-950/70"
            disabled={batchDeleting || selectedIds.size === 0}
            onClick={onDeleteSelected}
          >
            Delete selected ({selectedIds.size})
          </button>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Up to 500 per request. Pick a workspace first to filter by team member.
          </p>
        </div>

        {loading ? (
          <p className="px-4 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
            Loading…
          </p>
        ) : (
          <>
            <div className="relative min-h-[12rem] overflow-x-auto">
              {listLoading ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-neutral-950/80">
                  <span className="text-sm text-neutral-600 dark:text-neutral-300">
                    Loading…
                  </span>
                </div>
              ) : null}
              <Table
                columns={columns}
                rows={rows}
                emptyText="No leads match this filter."
              />
            </div>
            <PaginationBar
              page={page}
              pages={pages}
              total={total}
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
