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
import { hasPermission, Permissions } from "@/lib/permissions";

const { auth } = NextAuth(authConfig);

const userRoles = new Set<UserRole>([
  "SUPER_ADMIN",
  "REGISTRAR",
  "PRINCIPAL",
  "TEACHER",
]);

function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && userRoles.has(value as UserRole);
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
    !hasPermission(authenticatedUser.role, Permissions.DASHBOARD)
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
