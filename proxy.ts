import NextAuth from "next-auth";
import authConfig from "@/auth.config";
import { NextResponse } from "next/server";

import {
  apiAuthPrefix,
  authRoutes,
  publicRoutes,
  DEFAULT_LOGIN_REDIRECT,
} from "@/routes";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;

  const isLoggedIn = !!req.auth;

  const isApiAuthRoute = nextUrl.pathname.startsWith(apiAuthPrefix);
  const isPublicRoute = publicRoutes.includes(nextUrl.pathname);
  const isAuthRoute = authRoutes.includes(nextUrl.pathname);

  // Allow Auth.js API routes
  if (isApiAuthRoute) {
    return NextResponse.next();
  }

  // Prevent logged-in users from going back to /auth/login
  if (isAuthRoute) {
    if (isLoggedIn) {
      const role = req.auth?.user?.role;

      return NextResponse.redirect(
        new URL(DEFAULT_LOGIN_REDIRECT(role!), nextUrl),
      );
    }

    return NextResponse.next();
  }

  // Protect all private pages
  if (!isLoggedIn && !isPublicRoute) {
    return NextResponse.redirect(new URL("/auth/login", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/", "/(api|trpc)(.*)"],
};
