import api from "./api";

export async function login(email, password) {
  const { data } = await api.post("/auth/login", { email, password });
  return data;
}

export async function getMe() {
  const { data } = await api.get("/auth/me");
  return data;
}

export async function forgotPassword(email) {
  await api.post("/auth/forgot-password", { email });
}

export async function resetPassword(token, newPassword) {
  await api.post("/auth/reset-password", { token, new_password: newPassword });
}
