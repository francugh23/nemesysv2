import { z } from "zod";

export const CorrectShsStudentParticipationSchema = z.object({
  sourceStudentSubjectEnrollmentId: z.string().trim().min(1),
  sourceAcademicTermId: z.string().trim().min(1),
  replacementSubjectOfferingId: z.string().trim().min(1),
  reason: z.string().trim().min(1).max(500),
  evidenceReference: z.string().trim().min(1).max(500),
  typedConfirmation: z.string().trim().max(200).optional(),
  confirmed: z.literal(true),
});

export interface ShsStudentParticipationCorrectionPreview {
  enrollmentId: string;
  sourceStudentSubjectEnrollmentId: string;
  sourceAcademicTermId: string;
  eligible: boolean;
  blockers: string[];
  source: {
    subjectCode: string;
    subjectDescription: string;
    kind: "CORE" | "ACADEMIC_ELECTIVE" | "TECHPRO_ELECTIVE";
    selectedTerm: { id: string; name: string; position: number; startDate: Date; endDate: Date; resultStatus: string | null };
    plannedTerms: Array<{ id: string; name: string; position: number }>;
    resultStates: Array<{ id: string; name: string; status: string | null }>;
  };
  candidates: Array<{
    id: string;
    subjectCode: string;
    subjectDescription: string;
    kind: "CORE" | "ACADEMIC_ELECTIVE" | "TECHPRO_ELECTIVE";
    clusterName: string | null;
    termNames: string[];
  }>;
  policy: { minimumElectives: number; maximumElectives: number; activeElectiveCount: number } | null;
  requiresTypedConfirmation: boolean;
  typedConfirmationPhrase: string;
}

export type CorrectShsStudentParticipationInput = z.infer<typeof CorrectShsStudentParticipationSchema>;
