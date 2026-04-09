/** Display labels for fixed system workspaces */
export function workspaceLabel(name) {
  if (name === "free_workspace") return "Free workspace";
  if (name === "pro_workspace") return "Pro workspace";
  return name;
}
