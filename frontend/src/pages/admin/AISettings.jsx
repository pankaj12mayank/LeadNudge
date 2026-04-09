import { useEffect, useState } from "react";
import Card from "../../components/Card";
import { useSite } from "../../context/SiteContext";
import * as adminService from "../../services/adminService";
import { workspaceLabel } from "../../utils/workspaceLabel";

export default function AISettings() {
  const { site } = useSite();
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [aiMode, setAiMode] = useState("local");
  const [apiKey, setApiKey] = useState("");
  const [usageLimit, setUsageLimit] = useState(200);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const ollamaModel = site?.ollama_model || "—";
  const openaiModel = site?.openai_chat_model || "gpt-4o-mini";

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const ws = await adminService.listWorkspaces();
        if (!c) {
          setWorkspaces(ws);
          if (ws.length) setWorkspaceId(String(ws[0].id));
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
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    let c = false;
    (async () => {
      try {
        const s = await adminService.getSettings(Number(workspaceId));
        if (!c) {
          setAiMode(s.ai_mode);
          setApiKey(s.api_key && s.api_key !== "***" ? s.api_key : "");
          setUsageLimit(s.usage_limit);
        }
      } catch (e) {
        if (!c) setError(e.message);
      }
    })();
    return () => {
      c = true;
    };
  }, [workspaceId]);

  async function onSave(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      await adminService.updateAdminSettings({
        workspace_id: Number(workspaceId),
        ai_mode: aiMode,
        api_key: aiMode === "local" ? null : apiKey.trim() || null,
        usage_limit: usageLimit,
      });
      if (aiMode === "local") setApiKey("");
      setSuccess("Saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          AI configuration
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
          Settings are per <strong>workspace</strong>. Choose how draft follow-up text is
          generated. Ollama runs on your machine; OpenAI is optional and only used when you
          enable it below and provide a key (or set <code className="rounded bg-neutral-100 px-1 text-xs dark:bg-neutral-900">OPENAI_API_KEY</code> in{" "}
          <code className="rounded bg-neutral-100 px-1 text-xs dark:bg-neutral-900">backend/.env</code>{" "}
          with <code className="rounded bg-neutral-100 px-1 text-xs dark:bg-neutral-900">MODE=api</code>).
        </p>
      </div>

      <Card title="Models in use (from server)">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium text-neutral-800 dark:text-neutral-200">
              Ollama model
            </dt>
            <dd className="mt-0.5 text-neutral-600 dark:text-neutral-400">
              <code className="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-900">{ollamaModel}</code>
              {" — "}set via <code className="text-xs">OLLAMA_MODEL</code> in backend <code className="text-xs">.env</code>
            </dd>
          </div>
          <div>
            <dt className="font-medium text-neutral-800 dark:text-neutral-200">
              OpenAI chat model
            </dt>
            <dd className="mt-0.5 text-neutral-600 dark:text-neutral-400">
              <code className="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-900">{openaiModel}</code>
              {" — "}fixed in app for API mode
            </dd>
          </div>
        </dl>
      </Card>

      <Card title="Workspace AI">
        {loading ? (
          <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
        ) : (
          <form onSubmit={onSave} className="max-w-xl space-y-5">
            {error && (
              <p className="rounded-md border border-neutral-800 bg-neutral-100 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100">
                {error}
              </p>
            )}
            {success && (
              <p className="rounded-md border border-neutral-400 bg-neutral-50 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200">
                {success}
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
                      No API key here. Requires Ollama running at the URL in{" "}
                      <code className="text-xs">OLLAMA_URL</code>. Uses model{" "}
                      <code className="text-xs">{ollamaModel}</code>.
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
              <div>
                <label className="form-label">OpenAI API key (this workspace)</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="sk-…"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={saving}
                />
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  Stored for this workspace only. Leave blank to rely on server{" "}
                  <code className="text-xs">OPENAI_API_KEY</code> if configured.
                </p>
              </div>
            ) : (
              <p className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                OpenAI key fields are hidden in Ollama mode — no cloud key is used for this workspace.
              </p>
            )}

            <div>
              <label className="form-label">AI message cap (this workspace)</label>
              <input
                type="number"
                min={0}
                className="form-input max-w-xs"
                value={usageLimit}
                onChange={(e) => setUsageLimit(Number(e.target.value))}
                disabled={saving}
              />
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Free / Paid plans set a default when you create or change plan; you can override here.
              </p>
            </div>

            <button type="submit" disabled={saving || !workspaceId} className="btn-primary">
              Save
            </button>
          </form>
        )}
      </Card>
    </div>
  );
}
