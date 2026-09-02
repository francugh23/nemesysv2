import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const read = (file: string) => readFile(path.join(process.cwd(), file), "utf8");

test("Phase 23-C2 uses canonical exact scopes and rejects stale or duplicate input", async () => {
  const [schema, service] = await Promise.all([
    read("schemas/subject-assignment.schema.ts"),
    read("services/subject-assignment.service.ts"),
  ]);
  assert.match(schema, /AssignmentMatrixScopeSchema/);
  assert.match(schema, /expectedAssignmentId: z\.string\(\)\.min\(1\)\.nullable\(\)/);
  assert.match(schema, /action: z\.literal\("ASSIGN"\)/);
  assert.match(schema, /action: z\.literal\("CLEAR"\)/);
  assert.match(schema, /action: z\.literal\("COPY"\)/);
  assert.match(service, /assertDistinctScopes/);
  assert.match(service, /Duplicate teaching assignment scope submitted/);
  assert.match(service, /Teaching assignment state is stale/);
});

test("Phase 23-C2 validates every scope in a serializable AY-locked transaction before writes", async () => {
  const service = await read("services/subject-assignment.service.ts");
  assert.match(service, /lockAcademicYearForAcademicTerms\(validated\.academicYearId, transaction, "SHARE"\)/);
  assert.match(service, /Teaching assignments can only be changed while their Academic Year is active/);
  assert.match(service, /for \(const scope of orderedScopes\)[\s\S]*validateMatrixScope/);
  assert.match(service, /TransactionIsolationLevel\.Serializable/);
  assert.match(service, /Teacher not found or inactive/);
  assert.match(service, /Section not found or inactive/);
  assert.match(service, /Curriculum Offering and Section grade levels must match/);
  assert.match(service, /SHS Curriculum Offering must be school approved before assignment/);
  assert.doesNotMatch(service, /curriculumFinalization/);
});

test("Phase 23-C2 preserves initial started-Term assignment while protecting assigned ownership", async () => {
  const service = await read("services/subject-assignment.service.ts");
  assert.match(service, /change\.action === "CREATE"[\s\S]*createSubjectAssignment/);
  assert.match(service, /if \(started\) throw new Error\(change\.action === "ARCHIVE"/);
  assert.match(service, /Assigned teaching ownership cannot be cleared/);
  assert.match(service, /Assigned teaching ownership cannot be changed/);
  assert.match(service, /updateSubjectAssignment\(current\.id, \{ teacherId: change\.teacherId/);
  assert.match(service, /archiveSubjectAssignment\(current\.id, transaction\)/);
});

test("Phase 23-C2 copy uses authoritative source owners and atomically validates destinations", async () => {
  const service = await read("services/subject-assignment.service.ts");
  assert.match(service, /sourceTeacherByOfferingTerm/);
  assert.match(service, /assertExpectedAssignment\(source, assignment\)/);
  assert.match(service, /Copy source Teacher not found or inactive/);
  assert.match(service, /Every copy destination must match an explicitly selected source Offering Term/);
  assert.match(service, /assertExpectedAssignment\(destination, assignment\)/);
});

test("Phase 23-C2 writes per-assignment audits plus a bounded supplemental bulk summary", async () => {
  const service = await read("services/subject-assignment.service.ts");
  assert.match(service, /action: "CREATE", module: "SubjectAssignment"/);
  assert.match(service, /action: "UPDATE", module: "SubjectAssignment"/);
  assert.match(service, /action: "ARCHIVE", module: "SubjectAssignment"/);
  assert.match(service, /module: "SubjectAssignmentBulk"/);
  assert.match(service, /assignmentIds: changedAssignmentIds\.slice\(0, 100\)/);
  assert.match(service, /await createAuditLogs\(audits, transaction\)/);
});

test("Phase 23-C2 makes the matrix the bounded shadcn mutation surface", async () => {
  const matrix = await read("app/(protected)/dashboard/assignments/components/assignment-matrix.tsx");
  assert.match(matrix, /useMutateAssignmentMatrix/);
  assert.match(matrix, /Checkbox/);
  assert.match(matrix, /<Select/);
  assert.doesNotMatch(matrix, /<select/);
  assert.match(matrix, /Assign selected Terms/);
  assert.match(matrix, /Fill selected/);
  assert.match(matrix, /Copy to selected Sections/);
  assert.match(matrix, /Clear selected future scopes/);
  assert.match(matrix, /max-h-\[90dvh\][\s\S]*flex-col overflow-hidden/);
  assert.match(matrix, /ScrollArea className="min-h-0 flex-1/);
});
