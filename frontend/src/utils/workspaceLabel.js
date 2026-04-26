/**
 * Display labels for fixed system workspaces.
 * @param {string} name - Workspace slug from API (`workspace.name`), not the whole row object.
 */
export function workspaceLabel(name) {
  if (name === "free_workspace") return "Free workspace";
  if (name === "pro_workspace") return "Pro workspace";
  return name;
}

/** One-line explanation for admins */
export function workspaceDescription(name) {
  if (name === "free_workspace") {
    return "Default pool for Free-plan users. Invite new users here unless they are on Pro.";
  }
  if (name === "pro_workspace") {
    return "Pool for Pro-plan customers. Higher AI message caps when you raise them in AI configuration.";
  }
  return "";
}
