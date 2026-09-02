import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../..", import.meta.url);

async function source(path: string) {
  return readFile(new URL(path, root), "utf8");
}

test("Phase 23-C4.2 confirms only a server-resolved reviewed preview", async () => {
  const [schema, service, action] = await Promise.all([
    source("schemas/subject-assignment.schema.ts"),
    source("services/subject-assignment.service.ts"),
    source("actions/subject-assignment.action.ts"),
  ]);
  assert.match(schema, /SubjectAssignmentImportConfirmSchema[\s\S]*max\(2000\)[\s\S]*previewFingerprint/);
  assert.match(action, /confirmSubjectAssignmentImportAction[\s\S]*SubjectAssignmentImportConfirmSchema/);
  assert.match(service, /resolveSubjectAssignmentImport[\s\S]*createHash\("sha256"\)/);
  assert.match(service, /confirmSubjectAssignmentImport[\s\S]*TransactionIsolationLevel\.Serializable/);
  assert.match(service, /lockAcademicYearForAcademicTerms[\s\S]*"SHARE"/);
  assert.match(service, /resolved\.fingerprint !== validated\.previewFingerprint[\s\S]*Preview the file again before confirming/);
});

test("Phase 23-C4.2 keeps writes, audits, and invalidation atomic", async () => {
  const [service, hook, dialog] = await Promise.all([
    source("services/subject-assignment.service.ts"),
    source("hooks/subject-assignment.hook.ts"),
    source("app/(protected)/dashboard/assignments/components/teaching-assignment-import-dialog.tsx"),
  ]);
  const confirmation = service.slice(service.indexOf("export async function confirmSubjectAssignmentImport"), service.indexOf("export async function exportSubjectAssignments"));
  assert.match(confirmation, /action === "CREATE"[\s\S]*createSubjectAssignment/);
  assert.match(confirmation, /updateSubjectAssignment[\s\S]*SubjectAssignmentImport/);
  assert.match(confirmation, /unchangedCount \+= 1/);
  assert.match(confirmation, /module: "SubjectAssignmentImport"[\s\S]*assignmentIds: assignmentIds\.slice\(0, 100\)/);
  assert.match(hook, /useConfirmSubjectAssignmentImport[\s\S]*\["assignment-matrix"\][\s\S]*\["subject-assignments"\][\s\S]*\["subject-assignment-options"\]/);
  assert.match(dialog, /previewFingerprint: preview\.fingerprint[\s\S]*Confirm assignments/);
  assert.doesNotMatch(dialog, /teacherId|sectionId|subjectOfferingId|academicTermId|assignmentId/);
});
