import api from "./api";

export async function listWorkspaces() {
  const { data } = await api.get("/admin/workspaces");
  return data;
}

export async function updateWorkspacePlan(workspaceId, planType) {
  const { data } = await api.patch(`/admin/workspaces/${workspaceId}`, {
    plan_type: planType,
  });
  return data;
}

export async function createUser(payload) {
  const { data } = await api.post("/admin/users", payload);
  return data;
}

export async function listUsers(
  workspaceId,
  { page = 1, limit = 50, q } = {},
) {
  const params = { page, limit };
  if (workspaceId != null) params.workspace_id = workspaceId;
  if (q) params.q = q;
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

export async function getSystemStatus() {
  const { data } = await api.get("/admin/system-status");
  return data;
}

export async function getAdminActivity(limit = 20) {
  const { data } = await api.get("/admin/activity", {
    params: { limit },
  });
  return data;
}

export async function getUsageUsers({ workspaceId, page = 1, limit = 50 } = {}) {
  const params = { page, limit };
  if (workspaceId != null) params.workspace_id = workspaceId;
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
  await api.post("/admin/branding/mail/test", { to_email: toEmail });
}
