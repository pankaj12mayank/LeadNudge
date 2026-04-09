export function followupPriority(scheduledAt) {
  const t = new Date(scheduledAt).getTime();
  const now = Date.now();
  const diff = t - now;
  const day = 86400000;
  if (diff <= day) return "high";
  if (diff <= 7 * day) return "medium";
  return "low";
}

export function priorityLabel(p) {
  return p.charAt(0).toUpperCase() + p.slice(1);
}
