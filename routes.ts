import { UserRole } from "@/app/generated/prisma/enums";

export const publicRoutes = ["/", "/auth/login"];

export const authRoutes = ["/auth/login"];

export const apiAuthPrefix = "/api/auth";

export const DEFAULT_LOGIN_REDIRECT = (role: UserRole) => {
  switch (role) {
    case "SUPER_ADMIN":
      return "/dashboard";

    case "REGISTRAR":
      return "/registrar";

    case "PRINCIPAL":
      return "/principal";

    case "TEACHER":
      return "/teacher";

    default:
      return "/dashboard";
  }
};

export const roleRoutes = {
  SUPER_ADMIN: ["/dashboard"],

  REGISTRAR: ["/registrar"],

  PRINCIPAL: ["/principal"],

  TEACHER: ["/teacher"],
};