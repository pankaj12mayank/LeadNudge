import { API_BASE_URL } from "../utils/constants";

export async function getPublicSite() {
  const base = API_BASE_URL.replace(/\/$/, "");
  const url = `${base}/public/site`;
  const r = await fetch(url);
  if (!r.ok) {
    throw new Error("Could not load site settings");
  }
  return r.json();
}
