export type DashboardCapabilities = {
  corrections: boolean;
  results: boolean;
  audit: boolean;
};

export type StudentStatusSummary = {
  enrolled: number;
  unenrolled: number;
  transferred: number;
  dropped: number;
};

export type DashboardSectionPage = {
  state: "READY" | "NO_ACTIVE_ACADEMIC_YEAR";
  total: number;
  records: Array<{
    id: string;
    label: string;
    gradeLevel: string;
    count: number;
  }>;
};

export type DashboardReadModel =
  | {
      state: "NO_ACTIVE_ACADEMIC_YEAR";
      capabilities: DashboardCapabilities;
      system: { activeTeacherCount: number; studentStatusSummary: StudentStatusSummary };
    }
  | {
      state: "READY";
      capabilities: DashboardCapabilities;
      system: { studentStatusSummary: StudentStatusSummary };
      academicYear: {
        id: string;
        label: string;
        status: "ACTIVE";
        startDate: string;
        endDate: string;
      };
      summary: {
        activeStudentCount: number;
        activeEnrollmentCount: number;
        activeTeacherCount: number;
        activeSectionCount: number;
        jhsEnrollmentCount: number;
        shsEnrollmentCount: number;
        activeOfferingCount: number;
        schoolApprovedShsOfferingCount: number;
      };
      distributions: {
        grades: Array<{ gradeLevel: string; count: number }>;
        topSections: Array<{
          id: string;
          label: string;
          gradeLevel: string;
          count: number;
        }>;
      };
      curriculumReadiness: {
        activeOfferingCount: number;
        schoolApprovedShsOfferingCount: number;
        missingElectivePolicies:
          | { state: "NOT_DETERMINABLE"; message: string }
          | {
              state: "READY";
              missingScopes: Array<{ termName: string; gradeLevel: string }>;
            };
        warnings: string[];
      };
      resultSummary?: {
        draftCount: number;
        finalizedCount: number;
        revisedResultCount: number;
      };
      recentCorrections?: Array<{
        id: string;
        kind: "PLACEMENT" | "GRADE_PLACEMENT" | "SHS_PARTICIPATION";
        studentName: string;
        correctedAt: string;
      }>;
      recentResultRevisions?: Array<{
        id: string;
        subjectDescription: string;
        revisedAt: string;
      }>;
      recentAuditActivity?: Array<{
        id: string;
        action: string;
        module: string;
        description: string;
        createdAt: string;
        actorName: string;
      }>;
    };
