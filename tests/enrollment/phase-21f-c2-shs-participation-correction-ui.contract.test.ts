import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function source(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("C2 independently authorizes SHS correction context, preview, and history reads", () => {
  const action = source("actions/shs-student-participation-correction.action.ts");
  const service = source("services/shs-student-participation-correction-preview.service.ts");

  assert.equal((action.match(/requirePermission\(Permissions\.STUDENT_CORRECTIONS\)/g) ?? []).length >= 4, true);
  assert.equal((service.match(/requirePermission\(Permissions\.STUDENT_CORRECTIONS\)/g) ?? []).length, 3);
  assert.match(action, /getShsStudentParticipationCorrectionPreviewAction/);
  assert.match(action, /getShsStudentParticipationCorrectionHistoryAction/);
});

test("C2 preview keeps exact source Term scope and server-filters replacement candidates", () => {
  const service = source("services/shs-student-participation-correction-preview.service.ts");

  assert.match(service, /source\.terms\.filter\(\(\{ academicTerm \}\) => academicTerm\.position >= selectedTerm\.academicTerm\.position\)/);
  assert.match(service, /source\.selectionAcademicTermId !== termId \|\| source\.terms\.length !== 1/);
  assert.match(service, /offering\.shsContext\?\.classification !== source\.shsClassification/);
  assert.match(service, /plannedTerms\.every/);
  assert.match(service, /droppedOfferingIds/);
  assert.match(service, /findOfferingReplacementAncestors/);
  assert.match(service, /result !== null/);
  assert.match(service, /minimumElectives/);
});

test("C2 requires typed confirmation after the authoritative selected-Term start", () => {
  const mutation = source("services/shs-student-participation-correction-mutation.service.ts");
  const dialog = source("app/(protected)/dashboard/enrollment/components/correct-shs-student-participation-dialog.tsx");

  assert.match(mutation, /shsParticipationCorrectionRequiresTypedConfirmation\(sourceTerm\.startDate, clock\(\)\)/);
  assert.match(mutation, /values\.typedConfirmation !== getShsParticipationCorrectionTypedConfirmationPhrase/);
  assert.match(dialog, /preview\.requiresTypedConfirmation/);
  assert.match(dialog, /preview\.typedConfirmationPhrase/);
});

test("C2 keeps subject correction history and invalidation separate from placement correction", () => {
  const hook = source("hooks/enrollment.hook.ts");
  const history = source("app/(protected)/dashboard/enrollment/components/shs-student-participation-correction-history.tsx");

  assert.match(hook, /\["shs-student-participation-correction-history", id\]/);
  assert.match(hook, /\["shs-student-participation-correction-preview", id\]/);
  assert.match(hook, /\["student-subject-enrollments", id\]/);
  assert.match(history, /separate from placement history/);
});
