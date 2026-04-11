import api from "./api";

export async function listWorkspaces() {
  const { data } = await api.get("/admin/workspaces");
  return data;
}

export async function updateWorkspacePlan(workspaceId, planType, planExpiresAt) {
  const { data } = await api.patch(`/admin/workspaces/${workspaceId}`, {
    plan_type: planType,
    plan_expires_at: planExpiresAt ?? null,
  });
  return data;
}

export async function createUser(payload) {
  const { data } = await api.post("/admin/users", payload);
  return data;
}

export async function listUsers(
  workspaceId,
  { page = 1, limit = 50, q, plan, status } = {},
) {
  const params = { page, limit };
  if (workspaceId != null) params.workspace_id = workspaceId;
  if (q) params.q = q;
  if (plan) params.plan = plan;
  if (status) params.status = status;
  const { data } = await api.get("/admin/users", { params });
  return data;
}

export async function patchUser(userId, payload) {
  const { data } = await api.patch(`/admin/users/${userId}`, payload);
  return data;
}

export async function deleteUser(userId) {
  await api.delete(`/admin/users/${userId}`);
}

export async function setUserPassword(userId, newPassword) {
  const { data } = await api.post(`/admin/users/${userId}/password`, {
    new_password: newPassword,
  });
  return data;
}

export async function listEmailTemplates() {
  const { data } = await api.get("/admin/email-templates");
  return data;
}

export async function putEmailTemplate(name, payload) {
  const { data } = await api.put(
    `/admin/email-templates/${encodeURIComponent(name)}`,
    payload,
  );
  return data;
}

export async function listPasswordRequests({ page = 1, limit = 30 } = {}) {
  const { data } = await api.get("/admin/password-requests", {
    params: { page, limit },
  });
  return data;
}

export async function resolvePasswordRequest(id) {
  const { data } = await api.patch(`/admin/password-requests/${id}`);
  return data;
}

export async function getSystemStatus() {
  const { data } = await api.get("/admin/system-status");
  return data;
}

export async function getAdminActivity({ page = 1, limit = 20, period } = {}) {
  const params = { page, limit };
  if (period) params.period = period;
  const { data } = await api.get("/admin/activity", { params });
  return data;
}

export async function clearAdminActivity(range) {
  await api.post("/admin/activity/clear", { range });
}

export async function getSystemLogs({ page = 1, limit = 30, log_type } = {}) {
  const params = { page, limit };
  if (log_type) params.log_type = log_type;
  const { data } = await api.get("/admin/system-logs", { params });
  return data;
}

export async function listAdminSentEmails({ page = 1, limit = 30 } = {}) {
  const { data } = await api.get("/admin/sent-emails", {
    params: { page, limit },
  });
  return data;
}

export async function deleteAdminSentEmails(ids) {
  await api.post("/admin/sent-emails/delete", { ids });
}

export async function getUsageUsers({ workspaceId, page = 1, limit = 50 }) {
  const wid = Number(workspaceId);
  if (!Number.isFinite(wid) || wid < 1) {
    throw new Error("workspaceId is required");
  }
  const params = { page, limit, workspace_id: wid };
  const { data } = await api.get("/admin/usage/users", { params });
  return data;
}

export async function updateAdminSettings(payload) {
  const { data } = await api.put("/admin/settings", payload);
  return data;
}

export async function getOllamaInstalledModels() {
  const { data } = await api.get("/admin/ollama/models");
  return data;
}

export async function testOllamaModel(model) {
  const s = model != null ? String(model).trim() : "";
  const { data } = await api.post("/admin/ollama/test", {
    model: s ? s : null,
  });
  return data;
}

export async function testOpenAiKey({ workspaceId, apiKey }) {
  const { data } = await api.post("/admin/openai/test", {
    workspace_id: workspaceId,
    api_key: apiKey?.trim() ? apiKey.trim() : null,
  });
  return data;
}

export async function getSettings(workspaceId) {
  const { data } = await api.get("/settings", {
    params: { workspace_id: workspaceId },
  });
  return data;
}

export async function getAdminMe() {
  const { data } = await api.get("/admin/me");
  return data;
}

export async function patchAdminMe(payload) {
  const { data } = await api.patch("/admin/me", payload);
  return data;
}

export async function postAdminPassword(payload) {
  await api.post("/admin/me/password", payload);
}

export async function getAdminBranding() {
  const { data } = await api.get("/admin/branding");
  return data;
}

export async function putAdminBranding(payload) {
  const { data } = await api.put("/admin/branding", payload);
  return data;
}

export async function postAdminLogo(file) {
  const body = new FormData();
  body.append("file", file);
  const { data } = await api.post("/admin/branding/logo", body);
  return data;
}

export async function postAdminFavicon(file) {
  const body = new FormData();
  body.append("file", file);
  const { data } = await api.post("/admin/branding/favicon", body);
  return data;
}

export async function getBrandingMail() {
  const { data } = await api.get("/admin/branding/mail");
  return data;
}

export async function putBrandingMail(payload) {
  const { data } = await api.put("/admin/branding/mail", payload);
  return data;
}

export async function postBrandingMailTest(toEmail) {
  const { data } = await api.post("/settings/test-email", { to_email: toEmail });
  return data;
}

export async function pullOllamaModel(model) {
  const { data } = await api.post("/admin/ollama/pull", { model });
  return data;
}
