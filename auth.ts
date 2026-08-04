import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import authConfig from "./auth.config";
import { authenticateUser } from "@/services/auth.service";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  session: {
    strategy: "jwt",
    maxAge: 28_800,
  },

  providers: [
    Credentials({
      name: "Credentials",

      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const user = await authenticateUser(
          credentials.username as string,
          credentials.password as string,
        );

        if (!user) return null;

        return {
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isFirstLogin: user.isFirstLogin,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
});
