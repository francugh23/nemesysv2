import { UserRole } from "@/app/generated/prisma/enums";
import { DefaultSession } from "next-auth";
import { JWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      username: string;
      firstName: string;
      lastName: string;
      role: UserRole;
    };
  }

  interface User {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  }
}