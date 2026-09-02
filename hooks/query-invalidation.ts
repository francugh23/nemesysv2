import type { QueryClient } from "@tanstack/react-query";

type QueryInvalidator = Pick<QueryClient, "invalidateQueries">;

export function invalidateOperationalDashboard(
  queryClient: QueryInvalidator,
) {
  return queryClient.invalidateQueries({
    queryKey: ["dashboard", "operational"],
  });
}

export function invalidateAssignmentMatrixQueries(queryClient: QueryInvalidator) {
  return queryClient.invalidateQueries({ queryKey: ["assignment-matrix"] });
}

export function invalidateAcademicYearConfigurationQueries(
  queryClient: QueryInvalidator,
  academicYearId?: string,
) {
  return queryClient.invalidateQueries({
    queryKey: academicYearId
      ? ["academic-year-configuration", academicYearId]
      : ["academic-year-configuration"],
  });
}

export async function invalidateTeacherQueries(queryClient: QueryInvalidator) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["teachers"] }),
    queryClient.invalidateQueries({
      queryKey: ["subject-assignment-options"],
    }),
    queryClient.invalidateQueries({ queryKey: ["section-form-options"] }),
    invalidateAssignmentMatrixQueries(queryClient),
  ]);
}

export async function invalidateSubjectQueries(queryClient: QueryInvalidator) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["subjects"] }),
    queryClient.invalidateQueries({ queryKey: ["subject-offering-options"] }),
    queryClient.invalidateQueries({
      queryKey: ["subject-assignment-options"],
    }),
    invalidateAssignmentMatrixQueries(queryClient),
  ]);
}

export async function invalidateStudentQueries(queryClient: QueryInvalidator) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["students"] }),
    queryClient.invalidateQueries({ queryKey: ["enrollment-form-options"] }),
  ]);
}

export async function invalidateSectionQueries(queryClient: QueryInvalidator) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["sections"] }),
    queryClient.invalidateQueries({ queryKey: ["section-form-options"] }),
    queryClient.invalidateQueries({
      queryKey: ["subject-assignment-options"],
    }),
    queryClient.invalidateQueries({ queryKey: ["enrollment-form-options"] }),
    invalidateAssignmentMatrixQueries(queryClient),
  ]);
}

export async function invalidateAcademicYearQueries(
  queryClient: QueryInvalidator,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["academic-years"] }),
    invalidateAcademicYearConfigurationQueries(queryClient),
    queryClient.invalidateQueries({
      queryKey: ["subject-assignment-options"],
    }),
    queryClient.invalidateQueries({ queryKey: ["enrollment-form-options"] }),
    queryClient.invalidateQueries({ queryKey: ["subject-offering-options"] }),
    queryClient.invalidateQueries({ queryKey: ["shs-current-term-progression"] }),
    invalidateAssignmentMatrixQueries(queryClient),
  ]);
}

export async function invalidateAcademicTermQueries(
  queryClient: QueryInvalidator,
  academicYearId: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["academic-years"] }),
    invalidateAcademicYearConfigurationQueries(queryClient, academicYearId),
    queryClient.invalidateQueries({
      queryKey: ["academic-terms", academicYearId],
    }),
    queryClient.invalidateQueries({ queryKey: ["subject-offering-options"] }),
    invalidateOperationalDashboard(queryClient),
    invalidateAssignmentMatrixQueries(queryClient),
  ]);
}

export async function invalidateImportQueries(
  queryClient: QueryInvalidator,
  queryKey: readonly unknown[],
  dependentQueryKeys: readonly (readonly unknown[])[] = [],
) {
  await Promise.all(
    [queryKey, ...dependentQueryKeys].map((key) =>
      queryClient.invalidateQueries({ queryKey: key }),
    ),
  );
}
