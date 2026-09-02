export type MatrixCoverageFilter = "ALL" | "MISSING" | "ASSIGNED" | "MIXED_BY_TERM" | "PROTECTED";
export type MatrixTeacherFocus = "ALL" | "UNASSIGNED" | string;
export const MATRIX_SECTION_WINDOW_SIZE = 12;

export function getVisibleSectionIds({
  sectionIds,
  sectionFocus,
  windowStart,
  narrow,
}: {
  sectionIds: string[];
  sectionFocus: string;
  windowStart: number;
  narrow: boolean;
}) {
  if (!sectionIds.length) return [];
  if (sectionFocus !== "ALL")
    return sectionIds.includes(sectionFocus) ? [sectionFocus] : [];
  if (narrow) return [sectionIds[0]];
  if (sectionIds.length <= MATRIX_SECTION_WINDOW_SIZE) return sectionIds;
  return sectionIds.slice(windowStart, windowStart + MATRIX_SECTION_WINDOW_SIZE);
}

export function getSectionWindowRange(total: number, windowStart: number) {
  if (total <= MATRIX_SECTION_WINDOW_SIZE)
    return { start: 0, end: total, hasWindowing: false };
  const start = Math.min(
    Math.max(windowStart, 0),
    Math.floor((total - 1) / MATRIX_SECTION_WINDOW_SIZE) *
      MATRIX_SECTION_WINDOW_SIZE,
  );
  return {
    start,
    end: Math.min(start + MATRIX_SECTION_WINDOW_SIZE, total),
    hasWindowing: true,
  };
}

export type MatrixTermAssignment = {
  academicTermId: string;
  assignmentId: string | null;
  teacher: { id: string; name: string } | null;
  initialAssignmentAllowed: boolean;
  ownershipEditable: boolean;
  protectedOwnership: boolean;
  termHasStarted: boolean;
};

export type MatrixCell<T extends MatrixTermAssignment = MatrixTermAssignment> = {
  termAssignments: T[];
};

export type ProjectedMatrixCell<T extends MatrixTermAssignment = MatrixTermAssignment> = {
  state: "UNASSIGNED" | "SINGLE_TEACHER" | "MIXED_BY_TERM";
  termAssignments: T[];
  assignedScopeCount: number;
  missingScopeCount: number;
  protectedScopeCount: number;
  startedUnassignedScopeCount: number;
  actionableScopeCount: number;
};

export function projectMatrixCell<T extends MatrixTermAssignment>(cell: MatrixCell<T>, termId: string | null): ProjectedMatrixCell<T> {
  const termAssignments = termId ? cell.termAssignments.filter((term) => term.academicTermId === termId) : cell.termAssignments;
  const assigned = termAssignments.filter((term) => term.assignmentId);
  const teachers = new Set(assigned.map((term) => term.teacher?.id));
  const assignedScopeCount = assigned.length;
  const missingScopeCount = termAssignments.length - assignedScopeCount;

  return {
    state: assignedScopeCount === 0 ? "UNASSIGNED" : assignedScopeCount === termAssignments.length && teachers.size === 1 ? "SINGLE_TEACHER" : "MIXED_BY_TERM",
    termAssignments,
    assignedScopeCount,
    missingScopeCount,
    protectedScopeCount: assigned.filter((term) => term.protectedOwnership).length,
    startedUnassignedScopeCount: termAssignments.filter((term) => !term.assignmentId && term.termHasStarted && term.initialAssignmentAllowed).length,
    actionableScopeCount: termAssignments.filter((term) => term.initialAssignmentAllowed || term.ownershipEditable).length,
  };
}

export function matchesMatrixCoverageFilter(cell: ProjectedMatrixCell, filter: MatrixCoverageFilter) {
  if (filter === "ALL") return true;
  if (filter === "MISSING") return cell.missingScopeCount > 0;
  if (filter === "ASSIGNED") return cell.assignedScopeCount > 0;
  if (filter === "MIXED_BY_TERM") return cell.state === "MIXED_BY_TERM";
  return cell.protectedScopeCount > 0;
}

export function matchesMatrixTeacherFocus(cell: ProjectedMatrixCell, teacherFocus: MatrixTeacherFocus) {
  if (teacherFocus === "ALL") return true;
  if (teacherFocus === "UNASSIGNED") return cell.missingScopeCount > 0;
  return cell.termAssignments.some((term) => term.teacher?.id === teacherFocus);
}

export function matchingTeacherTerms<T extends MatrixTermAssignment>(cell: ProjectedMatrixCell<T>, teacherId: string) {
  return cell.termAssignments.filter((term) => term.teacher?.id === teacherId);
}

export type MissingMatrixScope = {
  offeringId: string;
  offeringCode: string;
  offeringDescription: string;
  sectionId: string;
  sectionName: string;
  academicTermId: string;
  academicTermName: string;
  termHasStarted: boolean;
  initialAssignmentAllowed: boolean;
};

export function groupMissingMatrixScopes(scopes: MissingMatrixScope[]) {
  const groups = new Map<string, { offeringId: string; offeringCode: string; offeringDescription: string; scopes: MissingMatrixScope[]; sectionNames: string[]; termNames: string[] }>();
  for (const scope of scopes) {
    const group = groups.get(scope.offeringId) ?? { offeringId: scope.offeringId, offeringCode: scope.offeringCode, offeringDescription: scope.offeringDescription, scopes: [], sectionNames: [], termNames: [] };
    group.scopes.push(scope);
    if (!group.sectionNames.includes(scope.sectionName)) group.sectionNames.push(scope.sectionName);
    if (!group.termNames.includes(scope.academicTermName)) group.termNames.push(scope.academicTermName);
    groups.set(scope.offeringId, group);
  }
  return [...groups.values()].sort((a, b) => a.offeringCode.localeCompare(b.offeringCode));
}

export function summarizeProjectedCells(cells: ProjectedMatrixCell[]) {
  const expectedScopes = cells.reduce((total, cell) => total + cell.termAssignments.length, 0);
  const assignedScopes = cells.reduce((total, cell) => total + cell.assignedScopeCount, 0);
  const missingScopes = expectedScopes - assignedScopes;

  return {
    expectedScopes,
    assignedScopes,
    missingScopes,
    coveragePercent: expectedScopes ? (assignedScopes / expectedScopes) * 100 : null,
    completeCells: cells.filter((cell) => cell.termAssignments.length > 0 && cell.missingScopeCount === 0).length,
    partiallyCoveredCells: cells.filter((cell) => cell.assignedScopeCount > 0 && cell.missingScopeCount > 0).length,
    mixedCells: cells.filter((cell) => cell.state === "MIXED_BY_TERM").length,
    protectedScopes: cells.reduce((total, cell) => total + cell.protectedScopeCount, 0),
    startedUnassignedScopes: cells.reduce((total, cell) => total + cell.startedUnassignedScopeCount, 0),
  };
}
