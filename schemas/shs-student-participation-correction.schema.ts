import { z } from "zod";

export const CorrectShsStudentParticipationSchema = z.object({
  sourceStudentSubjectEnrollmentId: z.string().trim().min(1),
  sourceAcademicTermId: z.string().trim().min(1),
  replacementSubjectOfferingId: z.string().trim().min(1),
  reason: z.string().trim().min(1).max(500),
  evidenceReference: z.string().trim().min(1).max(500),
  confirmed: z.literal(true),
});

export type CorrectShsStudentParticipationInput = z.infer<typeof CorrectShsStudentParticipationSchema>;
