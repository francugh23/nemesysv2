import type { UserRole } from "@/app/generated/prisma/enums";

export const Permissions = {
  USERS: "USERS",
  AUDIT_LOGS: "AUDIT_LOGS",
  DASHBOARD: "DASHBOARD",
  STUDENTS: "STUDENTS",
  TEACHERS: "TEACHERS",
  SUBJECTS: "SUBJECTS",
  SUBJECT_ASSIGNMENTS: "SUBJECT_ASSIGNMENTS",
  SECTIONS: "SECTIONS",
  ENROLLMENT: "ENROLLMENT",
  GRADES: "GRADES",
  ATTENDANCE: "ATTENDANCE",
  REPORT_CARDS: "REPORT_CARDS",
  ACADEMIC_YEARS: "ACADEMIC_YEARS",
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];

const PERMISSION_ROLES = {
  [Permissions.USERS]: ["SUPER_ADMIN"],
  [Permissions.AUDIT_LOGS]: ["SUPER_ADMIN"],
  [Permissions.DASHBOARD]: ["SUPER_ADMIN"],
  [Permissions.STUDENTS]: ["SUPER_ADMIN"],
  [Permissions.TEACHERS]: ["SUPER_ADMIN"],
  [Permissions.SUBJECTS]: ["SUPER_ADMIN"],
  [Permissions.SUBJECT_ASSIGNMENTS]: ["SUPER_ADMIN"],
  [Permissions.SECTIONS]: ["SUPER_ADMIN"],
  [Permissions.ENROLLMENT]: ["SUPER_ADMIN"],
  [Permissions.GRADES]: ["SUPER_ADMIN"],
  [Permissions.ATTENDANCE]: ["SUPER_ADMIN"],
  [Permissions.REPORT_CARDS]: ["SUPER_ADMIN"],
  [Permissions.ACADEMIC_YEARS]: ["SUPER_ADMIN", "REGISTRAR"],
} as const satisfies Record<Permission, readonly UserRole[]>;

export function getPermissionRoles(permission: Permission) {
  return PERMISSION_ROLES[permission];
}

export function hasPermission(
  role: UserRole | undefined,
  permission: Permission,
) {
  if (!role) {
    return false;
  }

  return (getPermissionRoles(permission) as readonly UserRole[]).includes(role);
}
