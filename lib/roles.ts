export type UserRole = "client" | "advisor" | "admin";

export function isAdvisorRole(role: UserRole): boolean {
  return role === "advisor" || role === "admin";
}

export function isAdminRole(role: UserRole): boolean {
  return role === "admin";
}
