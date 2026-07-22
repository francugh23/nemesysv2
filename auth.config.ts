import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

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
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;

      const isAuthPage = request.nextUrl.pathname.startsWith("/auth");

      if (isAuthPage && isLoggedIn) {
        return Response.redirect(new URL("/dashboard", request.nextUrl));
      }

      return true;
    },
  },
};

export default authConfig;