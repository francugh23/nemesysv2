import assert from "node:assert/strict";
import test from "node:test";

import { hasPermission, Permissions } from "../../lib/permissions";
import {
  CommitCurriculumAdoptionSchema,
  CurriculumAdoptionOptionsSchema,
  CurriculumAdoptionPreviewSchema,
} from "../../schemas/curriculum-adoption.schema";

const preview = {
  sourceAcademicYearId: "source-year",
  destinationAcademicYearId: "destination-year",
  termMappings: [
    {
      sourceAcademicTermId: "source-term-1",
      destinationAcademicTermId: "destination-term-1",
    },
    {
      sourceAcademicTermId: "source-term-2",
      destinationAcademicTermId: "destination-term-2",
    },
  ],
};

test("Phase 21B schemas require nonempty adoption identities, mappings, and selections", () => {
  assert.equal(CurriculumAdoptionOptionsSchema.safeParse({ destinationAcademicYearId: " " }).success, false);
  assert.equal(CurriculumAdoptionPreviewSchema.safeParse({ ...preview, sourceAcademicYearId: "" }).success, false);
  assert.equal(CurriculumAdoptionPreviewSchema.safeParse({ ...preview, termMappings: [] }).success, false);
  assert.equal(CommitCurriculumAdoptionSchema.safeParse({ ...preview, selectedSourceOfferingIds: [] }).success, false);
  assert.equal(CommitCurriculumAdoptionSchema.safeParse({ ...preview, selectedSourceOfferingIds: [" "] }).success, false);
});

test("Phase 21B rejects adoption into the source Academic Year", () => {
  const result = CurriculumAdoptionPreviewSchema.safeParse({
    ...preview,
    destinationAcademicYearId: preview.sourceAcademicYearId,
  });

  assert.equal(result.success, false);
  assert.match(result.error?.issues[0]?.message ?? "", /different from the source/i);
});

test("Phase 21B enforces bijective Term mapping inputs", () => {
  assert.equal(CurriculumAdoptionPreviewSchema.safeParse(preview).success, true);
  assert.equal(
    CurriculumAdoptionPreviewSchema.safeParse({
      ...preview,
      termMappings: [preview.termMappings[0], preview.termMappings[0]],
    }).success,
    false,
  );
  assert.equal(
    CurriculumAdoptionPreviewSchema.safeParse({
      ...preview,
      termMappings: preview.termMappings.map((mapping) => ({
        ...mapping,
        destinationAcademicTermId: "destination-term-1",
      })),
    }).success,
    false,
  );
});

test("Phase 21B rejects duplicate selected source Offerings", () => {
  const result = CommitCurriculumAdoptionSchema.safeParse({
    ...preview,
    selectedSourceOfferingIds: ["offering-1", "offering-1"],
  });

  assert.equal(result.success, false);
  assert.match(result.error?.issues[0]?.message ?? "", /must be unique/i);
});

test("Curriculum adoption uses the Super Admin-only Subjects permission", () => {
  assert.equal(hasPermission("SUPER_ADMIN", Permissions.SUBJECTS), true);
  assert.equal(hasPermission("REGISTRAR", Permissions.SUBJECTS), false);
  assert.equal(hasPermission("PRINCIPAL", Permissions.SUBJECTS), false);
  assert.equal(hasPermission("TEACHER", Permissions.SUBJECTS), false);
});
