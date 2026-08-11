import { z } from "zod";

import { BcryptPasswordInputSchema } from "@/lib/password-policy";

export const LoginSchema = z.object({
  username: z.string().trim().min(1, "Username is required.").max(100),
  password: BcryptPasswordInputSchema,
});

export * from "./student.schema"
export * from "./teacher.schema"
export * from "./subject.schema"
export * from "./subject-assignment.schema"
export * from "./section.schema"
export * from "./enrollment.schema"
export * from "./user.schema"
export * from "./audit.schema"
export * from "./export.schema"
export * from "./account.schema"
export * from "./academic-year.schema"
export * from "./academic-term.schema"
export * from "./subject-offering.schema"
