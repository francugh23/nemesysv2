import NextAuth from "next-auth";
import authConfig from "@/auth.config";
import { NextResponse } from "next/server";

import type { UserRole } from "@/app/generated/prisma/enums";
import {
  apiAuthPrefix,
  authRoutes,
  publicRoutes,
  DEFAULT_LOGIN_REDIRECT,
  COMPLETE_PASSWORD_ROUTE,
  INVALID_SESSION_ROUTE,
} from "@/routes";
import {
  hasPermission,
  Permissions,
  type Permission,
} from "@/lib/permissions";

const { auth } = NextAuth(authConfig);

const userRoles = new Set<UserRole>([
  "SUPER_ADMIN",
  "REGISTRAR",
  "PRINCIPAL",
  "TEACHER",
]);

const dashboardRoutePermissions: ReadonlyArray<{
  path: string;
  permission: Permission;
  exact?: boolean;
}> = [
  {
    path: "/dashboard",
    permission: Permissions.OPERATIONAL_DASHBOARD,
    exact: true,
  },
  {
    path: "/dashboard/academic-years",
    permission: Permissions.ACADEMIC_YEARS,
  },
  {
    path: "/dashboard/enrollment",
    permission: Permissions.ENROLLMENT,
  },
  {
    path: "/dashboard/subject-offerings",
    permission: Permissions.SHS_CURRICULUM_APPROVAL,
  },
];

function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && userRoles.has(value as UserRole);
}

function hasDashboardRoutePermission(role: UserRole, pathname: string) {
  return dashboardRoutePermissions.some(
    ({ path, permission, exact }) =>
      (exact ? pathname === path : pathname === path || pathname.startsWith(`${path}/`)) &&
      hasPermission(role, permission),
  );
}

export default auth((req) => {
  const { nextUrl } = req;

  const sessionUser = req.auth?.user;
  const authenticatedUser =
    typeof sessionUser?.id === "string" &&
    sessionUser.id.trim().length > 0 &&
    isUserRole(sessionUser.role)
      ? {
          id: sessionUser.id,
          role: sessionUser.role,
          isFirstLogin: sessionUser.isFirstLogin === true,
        }
      : null;
  const isLoggedIn = authenticatedUser !== null;

  const isApiAuthRoute = nextUrl.pathname.startsWith(apiAuthPrefix);
  const isPublicRoute = publicRoutes.includes(nextUrl.pathname);
  const isAuthRoute = authRoutes.includes(nextUrl.pathname);
  // Allow Auth.js API routes
  if (isApiAuthRoute) {
    return NextResponse.next();
  }

  if (
    authenticatedUser?.isFirstLogin &&
    nextUrl.pathname !== COMPLETE_PASSWORD_ROUTE &&
    nextUrl.pathname !== INVALID_SESSION_ROUTE &&
    !nextUrl.pathname.startsWith("/api/")
  ) {
    return NextResponse.redirect(new URL(COMPLETE_PASSWORD_ROUTE, nextUrl));
  }

  // Prevent logged-in users from going back to /auth/login
  if (isAuthRoute) {
    if (authenticatedUser) {
      return NextResponse.redirect(
        new URL(DEFAULT_LOGIN_REDIRECT(authenticatedUser.role), nextUrl),
      );
    }

    return NextResponse.next();
  }

  // Protect all private pages
  if (!isLoggedIn && !isPublicRoute) {
    return NextResponse.redirect(new URL("/auth/login", nextUrl));
  }

  if (
    authenticatedUser &&
    nextUrl.pathname.startsWith("/dashboard") &&
    !hasPermission(authenticatedUser.role, Permissions.DASHBOARD) &&
    !hasDashboardRoutePermission(authenticatedUser.role, nextUrl.pathname)
  ) {
    return NextResponse.redirect(
      new URL(DEFAULT_LOGIN_REDIRECT(authenticatedUser.role), nextUrl),
    );
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/", "/(api|trpc)(.*)"],
};
