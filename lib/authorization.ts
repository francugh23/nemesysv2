import "server-only";

import type { UserRole } from "@/app/generated/prisma/enums";
import { auth } from "@/auth";
import {
  getPermissionRoles,
  type Permission,
  Permissions,
} from "@/lib/permissions";

export { Permissions };

export class AuthorizationError extends Error {
  constructor(
    message: "Unauthorized." | "Forbidden.",
    readonly status: 401 | 403,
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export async function requireAuthenticatedUser() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new AuthorizationError("Unauthorized.", 401);
  }

  return session;
}

export async function requireRole(...roles: readonly UserRole[]) {
  const session = await requireAuthenticatedUser();

  if (!roles.includes(session.user.role)) {
    throw new AuthorizationError("Forbidden.", 403);
  }

  return session;
}

export async function requirePermission(permission: Permission) {
  return requireRole(...getPermissionRoles(permission));
}
