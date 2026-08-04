import "server-only";

import { cache } from "react";

import type { UserRole } from "@/app/generated/prisma/enums";
import { auth } from "@/auth";
import {
  getPermissionRoles,
  type Permission,
  Permissions,
} from "@/lib/permissions";
import { findActiveUserById } from "@/repositories/user.repository";

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

const getValidatedSession = cache(async () => {
  const session = await auth();

  if (!session?.user?.id) {
    throw new AuthorizationError("Unauthorized.", 401);
  }

  const user = await findActiveUserById(session.user.id);

  if (!user || user.sessionVersion !== session.user.sessionVersion) {
    throw new AuthorizationError("Unauthorized.", 401);
  }

  return {
    ...session,
    user: {
      ...session.user,
      id: user.id,
      role: user.role,
      isFirstLogin: user.isFirstLogin,
    },
  };
});

export async function requireAuthenticatedUser() {
  return getValidatedSession();
}

export async function requireRole(...roles: readonly UserRole[]) {
  const session = await requireAuthenticatedUser();

  if (session.user.isFirstLogin) {
    throw new AuthorizationError("Forbidden.", 403);
  }

  if (!roles.includes(session.user.role)) {
    throw new AuthorizationError("Forbidden.", 403);
  }

  return session;
}

export async function requirePermission(permission: Permission) {
  return requireRole(...getPermissionRoles(permission));
}
