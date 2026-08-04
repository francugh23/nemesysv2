import { UserRole } from "@/app/generated/prisma/enums";

export const INVALID_SESSION_ROUTE = "/session-invalid";

export const publicRoutes = ["/", "/auth/login", INVALID_SESSION_ROUTE];

export const authRoutes = ["/auth/login"];

export const apiAuthPrefix = "/api/auth";

export const COMPLETE_PASSWORD_ROUTE = "/account/complete-password";

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
