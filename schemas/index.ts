import { z } from "zod";

export const LoginSchema = z.object({
  username: z.string().min(1, "Username is required."),
  password: z.string().min(1, "Password is required."),
});

export * from "./student.schema"
export * from "./teacher.schema"
export * from "./subject.schema"
export * from "./subject-assignment.schema"
export * from "./section.schema"
export * from "./enrollment.schema"
