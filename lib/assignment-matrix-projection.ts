export type MatrixCoverageFilter = "ALL" | "MISSING" | "ASSIGNED" | "MIXED_BY_TERM" | "PROTECTED";

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
