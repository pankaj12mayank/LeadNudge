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

export async function listUsers(workspaceId, { page = 1, limit = 50 } = {}) {
  const params = { page, limit };
  if (workspaceId != null) params.workspace_id = workspaceId;
  const { data } = await api.get("/admin/users", { params });
  return data;
}

export async function updateAdminSettings(payload) {
  const { data } = await api.put("/admin/settings", payload);
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
