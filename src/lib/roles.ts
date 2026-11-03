export const ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "STUDENT", "PARENT"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Platform admin",
  SCHOOL_ADMIN: "School admin",
  STUDENT: "Student",
  PARENT: "Parent",
};

/** Roles that belong to a school; the others are platform-wide. */
export function needsSchool(role: string): boolean {
  return role === "SCHOOL_ADMIN" || role === "STUDENT";
}

export function homeFor(role: string): string {
  if (role === "SUPER_ADMIN") return "/admin";
  if (role === "SCHOOL_ADMIN") return "/school";
  if (role === "PARENT") return "/account";
  return "/learn";
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

const AREAS: [prefix: string, roles: Role[]][] = [
  ["/admin", ["SUPER_ADMIN"]],
  ["/school", ["SCHOOL_ADMIN"]],
  ["/learn", ["STUDENT"]],
  ["/account", ["PARENT"]],
];

/** Open to everyone: the library and its books. Each page still checks the book is one the viewer may open. */
const PUBLIC_AREAS = ["/library", "/stories", "/read", "/scan", "/print"];

function inArea(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** The roles that may open a path, or undefined if the path isn't in a protected area. */
export function rolesForPath(pathname: string): Role[] | undefined {
  return AREAS.find(([prefix]) => inArea(pathname, prefix))?.[1];
}

export function isPublicPath(pathname: string): boolean {
  return pathname === "/" || PUBLIC_AREAS.some((prefix) => inArea(pathname, prefix));
}

/** Where to go after signing in: ?next= when it's a local page this role can open, otherwise home. */
export function afterLoginPath(role: string, next: unknown): string {
  const home = homeFor(role);
  // Browsers treat "/\" like "//", which would leave this site.
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return home;
  const pathname = next.split(/[?#]/, 1)[0]!;
  if (isPublicPath(pathname)) return next;
  const roles = rolesForPath(pathname);
  return isRole(role) && roles?.includes(role) ? next : home;
}
