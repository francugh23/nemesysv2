import * as z from "zod";

export const CreateStudentSchema = z.object({
  lrn: z
    .string()
    .trim()
    .regex(/^\d{12}$/, "LRN must contain exactly 12 digits."),

  firstName: z.string().min(1, "First name is required."),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Last name is required."),
  gender: z.enum(["MALE", "FEMALE"]),
  dateOfBirth: z.date().optional(),
  purok: z.string().optional(),
  barangay: z.string().min(1, "Barangay is required."),
  municipality: z.string().min(1, "Municipality is required."),
  province: z.string().min(1, "Province is required."),
  zipCode: z.string().optional(),
  fatherName: z.string().optional(),
  fatherContact: z.string().optional(),
  motherName: z.string().optional(),
  motherContact: z.string().optional(),
  guardianName: z.string().optional(),
  guardianContact: z.string().optional(),
});