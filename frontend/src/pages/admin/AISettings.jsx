import { useEffect, useState } from "react";
import { toast } from "sonner";
import Card from "../../components/Card";
import PasswordField from "../../components/PasswordField";
import { useSite } from "../../context/SiteContext";
import * as adminService from "../../services/adminService";
import { workspaceLabel } from "../../utils/workspaceLabel";

const OLLAMA_PRESETS = ["llama3.2:latest", "mistral:latest", "gemma2:2b"];

/** Merge keys that support the extra line injected into bundled AI context / solution block */
const MERGE_CONTEXT_INTRO_KEYS = new Set(["problem_seen", "thread_message", "solution"]);

/** Prefer a name that exists in `ollama list` (API /tags), else server default e.g. llama3.2:latest */
function pickOllamaDefault(envDefault, models) {
  const def = (envDefault || "llama3.2:latest").trim() || "llama3.2:latest";
  if (!models?.length) return def;
  const exact = models.find((m) => m === def);
  if (exact) return exact;
  const ci = models.find((m) => m.toLowerCase() === def.toLowerCase());
  if (ci) return ci;
  const base = def.split(":")[0];
  const partial = models.find(
    (m) => m === base || m.startsWith(`${base}:`),
  );
  if (partial) return partial;
  return def;
}

export default function AISettings() {
  const { site } = useSite();
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [aiMode, setAiMode] = useState("local");
  const [apiKey, setApiKey] = useState("");
  const [usageLimit, setUsageLimit] = useState(200);
  const [ollamaWsModel, setOllamaWsModel] = useState("");
  const [ollamaMeta, setOllamaMeta] = useState({
    env_default: "",
    models: [],
    ollama_url: "",
    error: null,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingOllama, setTestingOllama] = useState(false);
  const [testingOpenAi, setTestingOpenAi] = useState(false);
  const [pullingOllama, setPullingOllama] = useState(false);

  const [mergeGlobalRows, setMergeGlobalRows] = useState([]);
  const [mergeWsRows, setMergeWsRows] = useState([]);
  const [mergeWsHasOverride, setMergeWsHasOverride] = useState(false);
  const [mergeGlobalLoading, setMergeGlobalLoading] = useState(true);
  const [mergeWsLoading, setMergeWsLoading] = useState(false);
  const [mergeSaveGlobalBusy, setMergeSaveGlobalBusy] = useState(false);
  const [mergeSaveWsBusy, setMergeSaveWsBusy] = useState(false);
  const [mergeClearWsBusy, setMergeClearWsBusy] = useState(false);

  const openaiModel = site?.openai_chat_model || "gpt-4o-mini";

  const siteOllamaUrl = site?.ollama_base_url || "http://127.0.0.1:11434";
  const siteOllamaModel = site?.ollama_model || "";

  const ollamaTrimmed = ollamaWsModel.trim();
  const ollamaNotInList =
    aiMode === "local" &&
    ollamaTrimmed &&
    ollamaMeta.models.length > 0 &&
    !ollamaMeta.models.includes(ollamaTrimmed);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const ws = await adminService.listWorkspaces();
        if (c) return;
        setWorkspaces(ws);
        setWorkspaceId((prev) => {
          if (prev && ws.some((w) => String(w.id) === prev)) return prev;
          return ws.length ? String(ws[0].id) : "";
        });

        let om = {
          env_default: siteOllamaModel,
          models: [],
          ollama_url: siteOllamaUrl.replace(/\/$/, ""),
          error: null,
        };
        try {
          om = await adminService.getOllamaInstalledModels();
        } catch (err) {
          const ax = err.original || err;
          const d = ax.response?.data?.detail;
          const detail =
            typeof d === "string"
              ? d
              : Array.isArray(d)
                ? d.map((x) => x?.msg || JSON.stringify(x)).join("; ")
                : err.message || "Request failed";
          om = {
            ...om,
            error: detail,
          };
        }
        if (!c) {
          setOllamaMeta({
            env_default: om.env_default || siteOllamaModel || "",
            models: om.models || [],
            ollama_url: (om.ollama_url || siteOllamaUrl).replace(/\/$/, ""),
            error: om.error || null,
          });
        }
      } catch (e) {
        if (!c) setError(e.message);
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [siteOllamaUrl, siteOllamaModel]);

  useEffect(() => {
    if (!workspaceId) return;
    let c = false;
    (async () => {
      try {
        const s = await adminService.getSettings(Number(workspaceId));
        if (c) return;
        setAiMode(s.ai_mode);
        setApiKey(s.api_key && s.api_key !== "***" ? s.api_key : "");
        setUsageLimit(s.usage_limit);
        const fromDb = (s.ollama_model || "").trim();
        if (fromDb) {
          setOllamaWsModel(fromDb);
        } else {
          setOllamaWsModel(
            pickOllamaDefault(
              ollamaMeta.env_default || siteOllamaModel,
              ollamaMeta.models,
            ),
          );
        }
      } catch (e) {
        if (!c) setError(e.message);
      }
    })();
    return () => {
      c = true;
    };
  }, [workspaceId]);

  function mergeRowsToFields(rows) {
    return (rows || []).map((r) => ({
      key: r.key,
      label: (r.label || "").trim(),
      description: (r.description || "").trim(),
      context_intro: MERGE_CONTEXT_INTRO_KEYS.has(r.key)
        ? (r.context_intro || "").trim() || null
        : null,
    }));
  }

  useEffect(() => {
    let c = false;
    (async () => {
      setMergeGlobalLoading(true);
      try {
        const d = await adminService.getLeadMergeFields();
        if (!c) setMergeGlobalRows(d.resolved || []);
      } catch (e) {
        if (!c) toast.error(e.message || "Could not load global merge labels");
      } finally {
        if (!c) setMergeGlobalLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  useEffect(() => {
    if (!workspaceId) {
      setMergeWsRows([]);
      setMergeWsHasOverride(false);
      return;
    }
    let c = false;
    (async () => {
      setMergeWsLoading(true);
      try {
        const d = await adminService.getLeadMergeFields(Number(workspaceId));
        if (!c) {
          setMergeWsRows(d.resolved || []);
          setMergeWsHasOverride(
            Boolean(d.workspace_override && Object.keys(d.workspace_override || {}).length),
          );
        }
      } catch (e) {
        if (!c) toast.error(e.message || "Could not load workspace merge labels");
      } finally {
        if (!c) setMergeWsLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [workspaceId]);

  async function onSaveMergeGlobal() {
    setMergeSaveGlobalBusy(true);
    try {
      await adminService.putLeadMergeFields({
        scope: "global",
        fields: mergeRowsToFields(mergeGlobalRows),
      });
      toast.success("Global lead labels saved", {
        description: "Used for all workspaces unless a workspace has its own override.",
      });
      const d = await adminService.getLeadMergeFields();
      setMergeGlobalRows(d.resolved || []);
      if (workspaceId) {
        const d2 = await adminService.getLeadMergeFields(Number(workspaceId));
        setMergeWsRows(d2.resolved || []);
        setMergeWsHasOverride(
          Boolean(d2.workspace_override && Object.keys(d2.workspace_override || {}).length),
        );
      }
    } catch (e) {
      toast.error(e.message || "Save failed");
    } finally {
      setMergeSaveGlobalBusy(false);
    }
  }

  async function onSaveMergeWorkspace() {
    if (!workspaceId) {
      toast.warning("Select a workspace first.");
      return;
    }
    setMergeSaveWsBusy(true);
    try {
      await adminService.putLeadMergeFields({
        scope: "workspace",
        workspace_id: Number(workspaceId),
        fields: mergeRowsToFields(mergeWsRows),
      });
      toast.success("Workspace label override saved", {
        description: "Only this workspace uses these names until you clear the override.",
      });
      const d2 = await adminService.getLeadMergeFields(Number(workspaceId));
      setMergeWsRows(d2.resolved || []);
      setMergeWsHasOverride(
        Boolean(d2.workspace_override && Object.keys(d2.workspace_override || {}).length),
      );
    } catch (e) {
      toast.error(e.message || "Save failed");
    } finally {
      setMergeSaveWsBusy(false);
    }
  }

  async function onClearMergeWorkspace() {
    if (!workspaceId) return;
    if (
      !confirm(
        "Remove workspace-specific labels? This workspace will follow the global defaults.",
      )
    ) {
      return;
    }
    setMergeClearWsBusy(true);
    try {
      await adminService.putLeadMergeFields({
        scope: "workspace",
        workspace_id: Number(workspaceId),
        clear_workspace_override: true,
        fields: [],
      });
      toast.success("Workspace label override cleared");
      const d2 = await adminService.getLeadMergeFields(Number(workspaceId));
      setMergeWsRows(d2.resolved || []);
      setMergeWsHasOverride(false);
    } catch (e) {
      toast.error(e.message || "Could not clear override");
    } finally {
      setMergeClearWsBusy(false);
    }
  }

  async function onTestOllama() {
    const m = ollamaTrimmed || null;
    setTestingOllama(true);
    try {
      const r = await adminService.testOllamaModel(m);
      if (r.ok) {
        const desc = [r.model ? `Model: ${r.model}` : null, r.preview]
          .filter(Boolean)
          .join(" · ");
        toast.success(r.message, { description: desc || undefined });
      } else {
        toast.error(
          r.model ? `${r.message} (model: ${r.model})` : r.message,
        );
      }
    } catch (err) {
      toast.error(err.message || "Ollama test failed");
    } finally {
      setTestingOllama(false);
    }
  }

  async function onPullOllama() {
    const name =
      ollamaTrimmed ||
      pickOllamaDefault(
        ollamaMeta.env_default || siteOllamaModel,
        ollamaMeta.models,
      );
    setPullingOllama(true);
    try {
      const r = await adminService.pullOllamaModel(name);
      if (r.ok) {
        toast.success(r.message);
      } else {
        toast.error(r.message);
      }
      try {
        const om = await adminService.getOllamaInstalledModels();
        setOllamaMeta({
          env_default: om.env_default || siteOllamaModel || "",
          models: om.models || [],
          ollama_url: (om.ollama_url || siteOllamaUrl).replace(/\/$/, ""),
          error: om.error || null,
        });
      } catch {
        /* ignore */
      }
    } catch (e) {
      toast.error(e.message || "Pull failed");
    } finally {
      setPullingOllama(false);
    }
  }

  async function onTestOpenAi() {
    if (!workspaceId) {
      toast.warning("Select a workspace first.");
      return;
    }
    setTestingOpenAi(true);
    try {
      const r = await adminService.testOpenAiKey({
        workspaceId: Number(workspaceId),
        apiKey: apiKey,
      });
      const src =
        r.key_source === "request"
          ? " (key from field)"
          : r.key_source === "workspace"
            ? " (saved workspace key)"
            : r.key_source === "env"
              ? " (OPENAI_API_KEY in .env)"
              : "";
      if (r.ok) {
        toast.success(`${r.message}${src}`, {
          description: r.preview || undefined,
        });
      } else {
        toast.error(`${r.message}${src}`);
      }
    } catch (err) {
      toast.error(err.message || "OpenAI test failed");
    } finally {
      setTestingOpenAi(false);
    }
  }

  async function onSave(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = {
        workspace_id: Number(workspaceId),
        ai_mode: aiMode,
        api_key: aiMode === "local" ? null : apiKey.trim() || null,
        usage_limit: usageLimit,
        ollama_model: ollamaWsModel.trim() || null,
      };
      const saved = await adminService.updateAdminSettings(payload);
      if (aiMode === "local") setApiKey("");

      let om = ollamaMeta;
      try {
        om = await adminService.getOllamaInstalledModels();
        setOllamaMeta({
          env_default: om.env_default || siteOllamaModel || "",
          models: om.models || [],
          ollama_url: (om.ollama_url || siteOllamaUrl).replace(/\/$/, ""),
          error: om.error || null,
        });
      } catch {
        /* keep previous meta */
      }

      const savedOm = (saved.ollama_model || "").trim();
      setOllamaWsModel(
        savedOm ||
          pickOllamaDefault(om.env_default || siteOllamaModel, om.models),
      );
      const ws = workspaces.find((w) => String(w.id) === String(workspaceId));
      const wsName = ws ? workspaceLabel(ws.name) : "this workspace";
      toast.success(`AI settings saved for «${wsName}»`, {
        description:
          "Generation source, model, and message cap are updated for that workspace.",
      });
    } catch (err) {
      const msg = err.message || "Could not save AI settings.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full space-y-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="w-full border-b border-neutral-200 pb-6 dark:border-neutral-800">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Intelligence
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Models &amp; limits per workspace
        </h1>
        <p className="mt-2 w-full text-sm text-neutral-600 dark:text-neutral-400">
          Settings apply per <strong>workspace</strong> (Free pool vs Pro pool). Ollama runs
          locally; OpenAI is optional when you enable API mode and provide a key (or set{" "}
          <code className="rounded bg-neutral-100 px-1 text-xs dark:bg-neutral-900">
            OPENAI_API_KEY
          </code>{" "}
          in{" "}
          <code className="rounded bg-neutral-100 px-1 text-xs dark:bg-neutral-900">
            backend/.env
          </code>{" "}
          with{" "}
          <code className="rounded bg-neutral-100 px-1 text-xs dark:bg-neutral-900">
            MODE=api
          </code>
          ).
        </p>
      </section>

      <Card title="Ollama models on this PC">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Ollama URL:{" "}
          <code className="rounded bg-neutral-100 px-1 text-xs dark:bg-neutral-900">
            {ollamaMeta.ollama_url || "—"}
          </code>
          . Server default from <code className="text-xs">OLLAMA_MODEL</code> /{" "}
          <code className="text-xs">.env</code>:{" "}
          <code className="rounded bg-neutral-100 px-1 text-xs dark:bg-neutral-900">
            {ollamaMeta.env_default || "—"}
          </code>
          . Run <code className="text-xs">ollama list</code> in a terminal — names must match{" "}
          <strong>exactly</strong> (e.g. <code className="text-xs">llama3.2:latest</code>).
        </p>
        {ollamaMeta.error ? (
          <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
            Could not read installed models: {ollamaMeta.error}. Is Ollama running?
          </p>
        ) : ollamaMeta.models.length ? (
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            Installed: {ollamaMeta.models.join(", ")}
          </p>
        ) : null}
        <div className="mt-4 space-y-2">
          <label className="form-label">OpenAI chat model (API mode)</label>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            <code className="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-900">
              {openaiModel}
            </code>{" "}
            — fixed in the app for cloud generation. Use{" "}
            <strong>Test OpenAI</strong> under Workspace AI to verify the key before relying on
            follow-ups.
          </p>
        </div>
      </Card>

      <Card title="Workspace AI">
        {loading ? (
          <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
        ) : (
          <form onSubmit={onSave} className="max-w-xl space-y-5">
            {error && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                {error}
              </p>
            )}
            <div>
              <label className="form-label">Workspace</label>
              <select
                className="form-select"
                value={workspaceId}
                onChange={(e) => setWorkspaceId(e.target.value)}
                disabled={saving}
              >
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {workspaceLabel(w.name)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="form-label">Generation source</span>
              <div className="mt-2 space-y-2">
                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-200 p-3 dark:border-neutral-700">
                  <input
                    type="radio"
                    name="ai"
                    className="mt-1"
                    checked={aiMode === "local"}
                    onChange={() => setAiMode("local")}
                  />
                  <span>
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">
                      Ollama (this computer)
                    </span>
                    <span className="mt-0.5 block text-sm text-neutral-600 dark:text-neutral-400">
                      No API key here. Requires Ollama running. Pick the model for this workspace
                      below (or leave blank to use the server default).
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-200 p-3 dark:border-neutral-700">
                  <input
                    type="radio"
                    name="ai"
                    className="mt-1"
                    checked={aiMode === "api"}
                    onChange={() => setAiMode("api")}
                  />
                  <span>
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">
                      OpenAI API
                    </span>
                    <span className="mt-0.5 block text-sm text-neutral-600 dark:text-neutral-400">
                      Uses <code className="text-xs">{openaiModel}</code>. If the request fails, the app falls back to Ollama. Backend{" "}
                      <code className="text-xs">MODE</code> must allow API (not forced local-only).
                    </span>
                  </span>
                </label>
              </div>
            </div>

            {aiMode === "api" ? (
              <div className="space-y-3">
                <PasswordField
                  label="OpenAI API key (this workspace)"
                  className="form-input"
                  placeholder="sk-…"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={saving}
                  autoComplete="new-password"
                />
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Stored for this workspace only. Leave blank to rely on server{" "}
                  <code className="text-xs">OPENAI_API_KEY</code> if configured.
                </p>
                <div>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={testingOpenAi || saving || !workspaceId}
                    onClick={onTestOpenAi}
                  >
                    {testingOpenAi ? "Testing…" : "Test AI response (OpenAI)"}
                  </button>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    Uses the key in the field if you typed one; otherwise the saved workspace key,
                    then <code className="text-xs">OPENAI_API_KEY</code>. Does not save anything.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="form-label" htmlFor="ollama-preset">
                  Model preset
                </label>
                <select
                  id="ollama-preset"
                  className="form-select w-full max-w-xl"
                  value={
                    OLLAMA_PRESETS.includes(ollamaWsModel.trim())
                      ? ollamaWsModel.trim()
                      : "__custom__"
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v !== "__custom__") setOllamaWsModel(v);
                  }}
                  disabled={saving || pullingOllama}
                >
                  {OLLAMA_PRESETS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                  <option value="__custom__">Custom (edit field below)</option>
                </select>
                <label className="form-label" htmlFor="ollama-model-ws">
                  Ollama model for this workspace
                </label>
                <input
                  id="ollama-model-ws"
                  className="form-input w-full max-w-xl"
                  list="ollama-model-options"
                  value={ollamaWsModel}
                  onChange={(e) => setOllamaWsModel(e.target.value)}
                  disabled={saving || pullingOllama}
                  placeholder={
                    ollamaMeta.env_default
                      ? `Leave empty for default: ${ollamaMeta.env_default}`
                      : "e.g. llama3.2:latest"
                  }
                  autoComplete="off"
                />
                <datalist id="ollama-model-options">
                  {ollamaMeta.models.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={testingOllama || saving || pullingOllama}
                    onClick={onTestOllama}
                  >
                    {testingOllama ? "Testing…" : "Test AI response (Ollama)"}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={pullingOllama || saving || testingOllama}
                    onClick={onPullOllama}
                  >
                    {pullingOllama ? "Pulling…" : "Pull model on server"}
                  </button>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Pull runs <code className="text-xs">ollama pull</code> on the machine where the API
                  runs (needs Ollama CLI in PATH). Test sends a short prompt; on failure the app may
                  fall back to <code className="text-xs">OLLAMA_MODEL</code> when generating drafts.
                </p>
                {ollamaNotInList ? (
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    This name is not in the current Ollama list above. Fix the spelling, pick from
                    the list, or run <code className="text-xs">ollama pull …</code> first.
                  </p>
                ) : null}
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Pick from the list or type the exact tag from <code className="text-xs">ollama list</code>.
                  Default is <code className="text-xs">llama3.2:latest</code> (from{" "}
                  <code className="text-xs">OLLAMA_MODEL</code>). Clear the field and save to use only
                  the server default with no workspace override.
                </p>
              </div>
            )}

            <div>
              <label className="form-label">Master AI message cap (workspace ceiling)</label>
              <input
                type="number"
                min={0}
                className="form-input max-w-xs"
                value={usageLimit}
                onChange={(e) => setUsageLimit(Number(e.target.value))}
                disabled={saving}
              />
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Maximum any user can be assigned under Admin → Users (personal caps must be ≤ this).
                Plan changes still set a default you can override here.
              </p>
            </div>

            <button type="submit" disabled={saving || !workspaceId} className="btn-primary">
              Save
            </button>
          </form>
        )}
      </Card>

      <Card title="Lead column labels &amp; AI merge fields">
        <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
          Global defaults apply to every workspace. You can override labels for the workspace
          selected above; portal Leads and follow-up AI context headings read these values on each
          request. Template placeholders stay the same (
          <code className="text-xs">{"{{problem_seen}}"}</code>,{" "}
          <code className="text-xs">{"{{solution}}"}</code>, …).
        </p>

        <h3 className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Global defaults
        </h3>
        {mergeGlobalLoading ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>
        ) : (
          <div className="mb-6 max-h-80 overflow-auto rounded-md border border-neutral-200 dark:border-neutral-700">
            <table className="min-w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-neutral-50 dark:bg-neutral-900">
                <tr>
                  <th className="border-b border-neutral-200 p-2 text-left dark:border-neutral-700">
                    Key
                  </th>
                  <th className="border-b border-neutral-200 p-2 text-left dark:border-neutral-700">
                    Placeholder
                  </th>
                  <th className="border-b border-neutral-200 p-2 text-left dark:border-neutral-700">
                    Label
                  </th>
                  <th className="border-b border-neutral-200 p-2 text-left dark:border-neutral-700">
                    Description
                  </th>
                  <th className="border-b border-neutral-200 p-2 text-left dark:border-neutral-700">
                    AI context heading
                  </th>
                </tr>
              </thead>
              <tbody>
                {mergeGlobalRows.map((r) => (
                  <tr key={r.key} className="border-b border-neutral-100 dark:border-neutral-800">
                    <td className="p-2 font-mono text-xs text-neutral-600 dark:text-neutral-400">
                      {r.key}
                    </td>
                    <td className="p-2 font-mono text-xs">{r.placeholder}</td>
                    <td className="p-2">
                      <input
                        className="form-input max-w-[10rem] text-sm"
                        value={r.label}
                        onChange={(e) =>
                          setMergeGlobalRows((rows) =>
                            rows.map((x) =>
                              x.key === r.key ? { ...x, label: e.target.value } : x,
                            ),
                          )
                        }
                        disabled={mergeSaveGlobalBusy}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        className="form-input max-w-[14rem] text-xs"
                        value={r.description || ""}
                        onChange={(e) =>
                          setMergeGlobalRows((rows) =>
                            rows.map((x) =>
                              x.key === r.key ? { ...x, description: e.target.value } : x,
                            ),
                          )
                        }
                        disabled={mergeSaveGlobalBusy}
                      />
                    </td>
                    <td className="p-2">
                      {MERGE_CONTEXT_INTRO_KEYS.has(r.key) ? (
                        <textarea
                          className="form-input min-h-[3rem] w-56 resize-y font-mono text-xs"
                          value={r.context_intro || ""}
                          onChange={(e) =>
                            setMergeGlobalRows((rows) =>
                              rows.map((x) =>
                                x.key === r.key ? { ...x, context_intro: e.target.value } : x,
                              ),
                            )
                          }
                          disabled={mergeSaveGlobalBusy}
                          spellCheck={false}
                        />
                      ) : (
                        <span className="text-xs text-neutral-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button
          type="button"
          className="btn-primary"
          disabled={mergeGlobalLoading || mergeSaveGlobalBusy}
          onClick={onSaveMergeGlobal}
        >
          {mergeSaveGlobalBusy ? "Saving…" : "Save global labels"}
        </button>

        <h3 className="mb-2 mt-8 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Selected workspace (effective labels)
        </h3>
        {!workspaceId ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Pick a workspace above.</p>
        ) : mergeWsLoading ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>
        ) : (
          <>
            {mergeWsHasOverride ? (
              <p className="mb-2 text-xs font-medium text-amber-800 dark:text-amber-200">
                This workspace has a custom override (not only global defaults).
              </p>
            ) : (
              <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
                No workspace override — showing global effective labels.
              </p>
            )}
            <div className="mb-3 max-h-80 overflow-auto rounded-md border border-neutral-200 dark:border-neutral-700">
              <table className="min-w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-neutral-50 dark:bg-neutral-900">
                  <tr>
                    <th className="border-b border-neutral-200 p-2 text-left dark:border-neutral-700">
                      Key
                    </th>
                    <th className="border-b border-neutral-200 p-2 text-left dark:border-neutral-700">
                      Placeholder
                    </th>
                    <th className="border-b border-neutral-200 p-2 text-left dark:border-neutral-700">
                      Label
                    </th>
                    <th className="border-b border-neutral-200 p-2 text-left dark:border-neutral-700">
                      Description
                    </th>
                    <th className="border-b border-neutral-200 p-2 text-left dark:border-neutral-700">
                      AI context heading
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mergeWsRows.map((r) => (
                    <tr key={r.key} className="border-b border-neutral-100 dark:border-neutral-800">
                      <td className="p-2 font-mono text-xs text-neutral-600 dark:text-neutral-400">
                        {r.key}
                      </td>
                      <td className="p-2 font-mono text-xs">{r.placeholder}</td>
                      <td className="p-2">
                        <input
                          className="form-input max-w-[10rem] text-sm"
                          value={r.label}
                          onChange={(e) =>
                            setMergeWsRows((rows) =>
                              rows.map((x) =>
                                x.key === r.key ? { ...x, label: e.target.value } : x,
                              ),
                            )
                          }
                          disabled={mergeSaveWsBusy || mergeClearWsBusy}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          className="form-input max-w-[14rem] text-xs"
                          value={r.description || ""}
                          onChange={(e) =>
                            setMergeWsRows((rows) =>
                              rows.map((x) =>
                                x.key === r.key ? { ...x, description: e.target.value } : x,
                              ),
                            )
                          }
                          disabled={mergeSaveWsBusy || mergeClearWsBusy}
                        />
                      </td>
                      <td className="p-2">
                        {MERGE_CONTEXT_INTRO_KEYS.has(r.key) ? (
                          <textarea
                            className="form-input min-h-[3rem] w-56 resize-y font-mono text-xs"
                            value={r.context_intro || ""}
                            onChange={(e) =>
                              setMergeWsRows((rows) =>
                                rows.map((x) =>
                                  x.key === r.key ? { ...x, context_intro: e.target.value } : x,
                                ),
                              )
                            }
                            disabled={mergeSaveWsBusy || mergeClearWsBusy}
                            spellCheck={false}
                          />
                        ) : (
                          <span className="text-xs text-neutral-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary"
                disabled={mergeSaveWsBusy || mergeClearWsBusy}
                onClick={onSaveMergeWorkspace}
              >
                {mergeSaveWsBusy ? "Saving…" : "Save override for this workspace"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={!mergeWsHasOverride || mergeSaveWsBusy || mergeClearWsBusy}
                onClick={onClearMergeWorkspace}
              >
                {mergeClearWsBusy ? "Clearing…" : "Remove workspace override"}
              </button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
