/** Backend static URLs: /static/uploads/... */
export function mediaUrl(path) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const base = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
  if (base) return `${base}${path}`;
  return path;
}
