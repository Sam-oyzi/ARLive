export const ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "STUDENT"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Platform admin",
  SCHOOL_ADMIN: "School admin",
  STUDENT: "Student",
};

export function homeFor(role: string): string {
  if (role === "SUPER_ADMIN") return "/admin";
  if (role === "SCHOOL_ADMIN") return "/school";
  return "/learn";
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
