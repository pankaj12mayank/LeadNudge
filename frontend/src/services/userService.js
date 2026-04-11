import api from "./api";

export async function listLeads(
  workspaceId,
  { page = 1, limit = 50, q } = {},
) {
  const params = { page, limit };
  if (workspaceId != null) params.workspace_id = workspaceId;
  if (q) params.q = q;
  const { data } = await api.get("/leads", { params });
  return data;
}

export async function createLead(payload, workspaceId) {
  const params =
    workspaceId != null ? { workspace_id: workspaceId } : undefined;
  const { data } = await api.post("/leads", payload, params ? { params } : {});
  return data;
}

export async function updateLead(id, payload) {
  const { data } = await api.put(`/leads/${id}`, payload);
  return data;
}

export async function deleteLead(id) {
  await api.delete(`/leads/${id}`);
}

export async function deleteLeadsBatch(ids) {
  const { data } = await api.post("/leads/bulk-delete", { ids });
  return data;
}

export async function importLeadsCsv(file, workspaceId) {
  const body = new FormData();
  body.append("file", file);
  const params =
    workspaceId != null ? { workspace_id: workspaceId } : undefined;
  const { data } = await api.post("/leads/import-csv", body, { params });
  return data;
}

export async function downloadLeadsCsvSample() {
  const { data } = await api.get("/leads/csv-sample", {
    responseType: "blob",
  });
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = "leads_sample.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export async function listFollowups(workspaceId, { page = 1, limit = 50 } = {}) {
  const params = { page, limit };
  if (workspaceId != null) params.workspace_id = workspaceId;
  const { data } = await api.get("/followups", { params });
  return data;
}

export async function createFollowup(payload) {
  const { data } = await api.post("/followups", payload);
  return data;
}

export async function listOutboundMails({ page = 1, limit = 50, q } = {}) {
  const params = { page, limit };
  if (q) params.q = q;
  const { data } = await api.get("/outbound-mails", { params });
  return data;
}

export async function deleteFollowup(id) {
  await api.delete(`/followups/${id}`);
}

export async function patchFollowup(id, payload) {
  const { data } = await api.patch(`/followups/${id}`, payload);
  return data;
}

export async function getSettings(workspaceId) {
  const params =
    workspaceId != null ? { workspace_id: workspaceId } : undefined;
  const { data } = await api.get("/settings", params ? { params } : {});
  return data;
}

export async function updateSettings(payload, workspaceId) {
  const params =
    workspaceId != null ? { workspace_id: workspaceId } : undefined;
  const { data } = await api.put("/settings", payload, params ? { params } : {});
  return data;
}

export async function testSmtp() {
  const { data } = await api.post("/settings/smtp/test");
  return data;
}

export async function getAccount() {
  const { data } = await api.get("/account");
  return data;
}

export async function patchAccount(payload) {
  const { data } = await api.patch("/account", payload);
  return data;
}

export async function postAccountPassword(payload) {
  await api.post("/account/password", payload);
}
