import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { COMPLETE_PASSWORD_ROUTE } from "@/routes";

const authConfig: NextAuthConfig = {
  trustHost: true,

  providers: [
    Credentials({
      name: "Credentials",
      credentials: {},
      async authorize() {
        return null;
      },
    }),
  ],

  session: {
    strategy: "jwt",
  },

  pages: {
    signIn: "/auth/login",
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
        token.role = user.role;
        token.isFirstLogin = user.isFirstLogin;
        token.sessionVersion = user.sessionVersion;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.firstName = token.firstName as string;
        session.user.lastName = token.lastName as string;
        session.user.role = token.role;
        session.user.isFirstLogin = token.isFirstLogin;
        session.user.sessionVersion = token.sessionVersion;
      }

      return session;
    },

    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;

      const isAuthPage = request.nextUrl.pathname.startsWith("/auth");

      if (isAuthPage && isLoggedIn) {
        return Response.redirect(
          new URL(COMPLETE_PASSWORD_ROUTE, request.nextUrl),
        );
      }

      return true;
    },
  },
};

export default authConfig;
