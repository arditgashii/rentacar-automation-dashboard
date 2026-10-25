// Who may do what. Pages and API routes ask the same questions, so they never disagree.

export type Role = "admin" | "editor" | "viewer";

export type Area = "automation" | "settings" | "members" | "testPlans" | "regression";

export const ROLE_LABELS: Record<Role, string> = { admin: "Admin", editor: "Editor", viewer: "Viewer" };

/** May this role open the area at all? */
export function canRead(role: Role | null, area: Area): boolean {
  if (!role) return false;
  if (area === "automation" || area === "settings" || area === "members") return role === "admin";
  return true;
}

/** May this role change data in the area? */
export function canWrite(role: Role | null, area: Area): boolean {
  if (!role) return false;
  if (area === "automation" || area === "settings" || area === "members") return role === "admin";
  return role === "admin" || role === "editor";
}

/** Where a member lands after login, or when an area is closed to them. */
export function homeFor(role: Role | null): string {
  return role === "admin" ? "/automation-test" : "/test-plans";
}
