import "dotenv/config";

import prisma from "../lib/prisma";

type Count = bigint | number;

interface SnapshotRow {
  subjectCount: Count;
  activeSubjectCount: Count;
  deletedSubjectCount: Count;
  assignmentCount: Count;
  gradeCount: Count;
  latestSubjectCreatedAt: Date | null;
  latestSubjectUpdatedAt: Date | null;
  latestAssignmentUpdatedAt: Date | null;
  latestGradeUpdatedAt: Date | null;
  migrationCount: Count;
  latestMigrationFinishedAt: Date | null;
}

interface AuditRow {
  id: string;
  code: string;
  gradeLevel: string;
  trackStrand: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  normalizedCode: string;
  normalizedGradeLevel: string;
  normalizedTrackStrand: string;
  assignmentCount: Count;
  activeAssignmentCount: Count;
  gradeCount: Count;
  activeGradeCount: Count;
}

interface CollisionRow {
  id: string;
  code: string;
  gradeLevel: string;
  trackStrand: string | null;
  deletedAt: Date | null;
  normalizedCode: string;
  normalizedGradeLevel: string;
  normalizedTrackStrand: string;
  hasLowercaseCode: boolean;
  hasCodeWhitespace: boolean;
  hasNonCanonicalGradeLevel: boolean;
  hasLowercaseTrackStrand: boolean;
  hasTrackStrandWhitespace: boolean;
  hasBlankTrackStrand: boolean;
  hasBlankCode: boolean;
  hasInvalidGradeLevel: boolean;
  hasJhsTrackStrand: boolean;
}

function number(value: Count) {
  return Number(value);
}

function date(value: Date | null) {
  return value?.toISOString() ?? null;
}

function trackStrandState(trackStrand: string | null) {
  if (trackStrand === null) return "null";
  if (trackStrand.trim() === "") return "blank";
  return "value";
}

async function snapshot() {
  const [result] = await prisma.$queryRaw<SnapshotRow[]>`
    SELECT
      (SELECT COUNT(*) FROM "Subject") AS "subjectCount",
      (SELECT COUNT(*) FROM "Subject" WHERE "deletedAt" IS NULL) AS "activeSubjectCount",
      (SELECT COUNT(*) FROM "Subject" WHERE "deletedAt" IS NOT NULL) AS "deletedSubjectCount",
      (SELECT COUNT(*) FROM "SubjectAssignment") AS "assignmentCount",
      (SELECT COUNT(*) FROM "Grade") AS "gradeCount",
      (SELECT MAX("createdAt") FROM "Subject") AS "latestSubjectCreatedAt",
      (SELECT MAX("updatedAt") FROM "Subject") AS "latestSubjectUpdatedAt",
      (SELECT MAX("updatedAt") FROM "SubjectAssignment") AS "latestAssignmentUpdatedAt",
      (SELECT MAX("updatedAt") FROM "Grade") AS "latestGradeUpdatedAt",
      (SELECT COUNT(*) FROM "_prisma_migrations") AS "migrationCount",
      (SELECT MAX("finished_at") FROM "_prisma_migrations") AS "latestMigrationFinishedAt"
  `;

  return {
    subjectCount: number(result.subjectCount),
    activeSubjectCount: number(result.activeSubjectCount),
    deletedSubjectCount: number(result.deletedSubjectCount),
    assignmentCount: number(result.assignmentCount),
    gradeCount: number(result.gradeCount),
    latestSubjectCreatedAt: date(result.latestSubjectCreatedAt),
    latestSubjectUpdatedAt: date(result.latestSubjectUpdatedAt),
    latestAssignmentUpdatedAt: date(result.latestAssignmentUpdatedAt),
    latestGradeUpdatedAt: date(result.latestGradeUpdatedAt),
    migrationCount: number(result.migrationCount),
    latestMigrationFinishedAt: date(result.latestMigrationFinishedAt),
  };
}

async function getDuplicateRows() {
  return prisma.$queryRaw<AuditRow[]>`
    WITH normalized_subjects AS (
      SELECT
        "id",
        "code",
        "gradeLevel",
        "trackStrand",
        "createdAt",
        "updatedAt",
        "deletedAt",
        UPPER(BTRIM("code")) AS "normalizedCode",
        CASE UPPER(BTRIM("gradeLevel"))
          WHEN 'GRADE 7' THEN '7'
          WHEN 'GRADE 8' THEN '8'
          WHEN 'GRADE 9' THEN '9'
          WHEN 'GRADE 10' THEN '10'
          WHEN 'GRADE 11' THEN '11'
          WHEN 'GRADE 12' THEN '12'
          ELSE BTRIM("gradeLevel")
        END AS "normalizedGradeLevel",
        COALESCE(NULLIF(UPPER(BTRIM("trackStrand")), ''), '') AS "normalizedTrackStrand"
      FROM "Subject"
    ),
    duplicate_identities AS (
      SELECT
        "normalizedCode",
        "normalizedGradeLevel",
        "normalizedTrackStrand"
      FROM normalized_subjects
      GROUP BY 1, 2, 3
      HAVING COUNT(*) > 1
    )
    SELECT
      subjects.*,
      (
        SELECT COUNT(*)
        FROM "SubjectAssignment"
        WHERE "subjectId" = subjects."id"
      ) AS "assignmentCount",
      (
        SELECT COUNT(*)
        FROM "SubjectAssignment"
        WHERE "subjectId" = subjects."id" AND "deletedAt" IS NULL
      ) AS "activeAssignmentCount",
      (
        SELECT COUNT(*)
        FROM "Grade"
        WHERE "subjectId" = subjects."id"
      ) AS "gradeCount",
      (
        SELECT COUNT(*)
        FROM "Grade"
        WHERE "subjectId" = subjects."id" AND "deletedAt" IS NULL
      ) AS "activeGradeCount"
    FROM normalized_subjects AS subjects
    INNER JOIN duplicate_identities AS identities
      ON subjects."normalizedCode" = identities."normalizedCode"
      AND subjects."normalizedGradeLevel" = identities."normalizedGradeLevel"
      AND subjects."normalizedTrackStrand" = identities."normalizedTrackStrand"
    ORDER BY 8, 9, 10, subjects."createdAt", subjects."id"
  `;
}

async function getNormalizationCollisions() {
  return prisma.$queryRaw<CollisionRow[]>`
    SELECT
      "id",
      "code",
      "gradeLevel",
      "trackStrand",
      "deletedAt",
      UPPER(BTRIM("code")) AS "normalizedCode",
      CASE UPPER(BTRIM("gradeLevel"))
        WHEN 'GRADE 7' THEN '7'
        WHEN 'GRADE 8' THEN '8'
        WHEN 'GRADE 9' THEN '9'
        WHEN 'GRADE 10' THEN '10'
        WHEN 'GRADE 11' THEN '11'
        WHEN 'GRADE 12' THEN '12'
        ELSE BTRIM("gradeLevel")
      END AS "normalizedGradeLevel",
      COALESCE(NULLIF(UPPER(BTRIM("trackStrand")), ''), '') AS "normalizedTrackStrand",
      "code" <> UPPER("code") AS "hasLowercaseCode",
      "code" <> BTRIM("code") AS "hasCodeWhitespace",
      BTRIM("gradeLevel") <> CASE UPPER(BTRIM("gradeLevel"))
        WHEN 'GRADE 7' THEN '7'
        WHEN 'GRADE 8' THEN '8'
        WHEN 'GRADE 9' THEN '9'
        WHEN 'GRADE 10' THEN '10'
        WHEN 'GRADE 11' THEN '11'
        WHEN 'GRADE 12' THEN '12'
        ELSE BTRIM("gradeLevel")
      END AS "hasNonCanonicalGradeLevel",
      "trackStrand" IS NOT NULL AND "trackStrand" <> UPPER("trackStrand") AS "hasLowercaseTrackStrand",
      "trackStrand" IS NOT NULL AND "trackStrand" <> BTRIM("trackStrand") AS "hasTrackStrandWhitespace",
      "trackStrand" IS NOT NULL AND BTRIM("trackStrand") = '' AS "hasBlankTrackStrand",
      BTRIM("code") = '' AS "hasBlankCode",
      UPPER(BTRIM("gradeLevel")) NOT IN (
        '7', '8', '9', '10', '11', '12',
        'GRADE 7', 'GRADE 8', 'GRADE 9',
        'GRADE 10', 'GRADE 11', 'GRADE 12'
      ) AS "hasInvalidGradeLevel",
      CASE UPPER(BTRIM("gradeLevel"))
        WHEN '7' THEN NULLIF(BTRIM("trackStrand"), '') IS NOT NULL
        WHEN '8' THEN NULLIF(BTRIM("trackStrand"), '') IS NOT NULL
        WHEN '9' THEN NULLIF(BTRIM("trackStrand"), '') IS NOT NULL
        WHEN '10' THEN NULLIF(BTRIM("trackStrand"), '') IS NOT NULL
        WHEN 'GRADE 7' THEN NULLIF(BTRIM("trackStrand"), '') IS NOT NULL
        WHEN 'GRADE 8' THEN NULLIF(BTRIM("trackStrand"), '') IS NOT NULL
        WHEN 'GRADE 9' THEN NULLIF(BTRIM("trackStrand"), '') IS NOT NULL
        WHEN 'GRADE 10' THEN NULLIF(BTRIM("trackStrand"), '') IS NOT NULL
        ELSE FALSE
      END AS "hasJhsTrackStrand"
    FROM "Subject"
    WHERE
      "code" <> UPPER(BTRIM("code"))
      OR BTRIM("gradeLevel") <> CASE UPPER(BTRIM("gradeLevel"))
        WHEN 'GRADE 7' THEN '7'
        WHEN 'GRADE 8' THEN '8'
        WHEN 'GRADE 9' THEN '9'
        WHEN 'GRADE 10' THEN '10'
        WHEN 'GRADE 11' THEN '11'
        WHEN 'GRADE 12' THEN '12'
        ELSE BTRIM("gradeLevel")
      END
      OR "trackStrand" IS NOT NULL AND "trackStrand" <> NULLIF(UPPER(BTRIM("trackStrand")), '')
      OR BTRIM("code") = ''
      OR UPPER(BTRIM("gradeLevel")) NOT IN (
        '7', '8', '9', '10', '11', '12',
        'GRADE 7', 'GRADE 8', 'GRADE 9',
        'GRADE 10', 'GRADE 11', 'GRADE 12'
      )
      OR CASE UPPER(BTRIM("gradeLevel"))
        WHEN '7' THEN NULLIF(BTRIM("trackStrand"), '') IS NOT NULL
        WHEN '8' THEN NULLIF(BTRIM("trackStrand"), '') IS NOT NULL
        WHEN '9' THEN NULLIF(BTRIM("trackStrand"), '') IS NOT NULL
        WHEN '10' THEN NULLIF(BTRIM("trackStrand"), '') IS NOT NULL
        WHEN 'GRADE 7' THEN NULLIF(BTRIM("trackStrand"), '') IS NOT NULL
        WHEN 'GRADE 8' THEN NULLIF(BTRIM("trackStrand"), '') IS NOT NULL
        WHEN 'GRADE 9' THEN NULLIF(BTRIM("trackStrand"), '') IS NOT NULL
        WHEN 'GRADE 10' THEN NULLIF(BTRIM("trackStrand"), '') IS NOT NULL
        ELSE FALSE
      END
    ORDER BY "id"
  `;
}

async function main() {
  const before = await snapshot();
  const [duplicateRows, collisionRows] = await Promise.all([
    getDuplicateRows(),
    getNormalizationCollisions(),
  ]);
  const after = await snapshot();

  const duplicateGroups = new Map<
    string,
    {
      identity: { code: string; gradeLevel: string; trackStrand: string | null };
      subjects: unknown[];
      activeSubjects: number;
      deletedSubjects: number;
    }
  >();

  for (const row of duplicateRows) {
    const key = [
      row.normalizedCode,
      row.normalizedGradeLevel,
      row.normalizedTrackStrand,
    ].join("\u0000");
    const group = duplicateGroups.get(key) ?? {
      identity: {
        code: row.normalizedCode,
        gradeLevel: row.normalizedGradeLevel,
        trackStrand: row.normalizedTrackStrand || null,
      },
      subjects: [],
      activeSubjects: 0,
      deletedSubjects: 0,
    };
    const active = row.deletedAt === null;

    group.subjects.push({
      id: row.id,
      status: active ? "active" : "deleted",
      rawIdentity: {
        code: row.code,
        gradeLevel: row.gradeLevel,
        trackStrand: row.trackStrand,
        trackStrandState: trackStrandState(row.trackStrand),
      },
      dependencyCounts: {
        subjectAssignments: {
          total: number(row.assignmentCount),
          active: number(row.activeAssignmentCount),
        },
        grades: {
          total: number(row.gradeCount),
          active: number(row.activeGradeCount),
        },
      },
      createdAt: date(row.createdAt),
      updatedAt: date(row.updatedAt),
      deletedAt: date(row.deletedAt),
    });
    group.activeSubjects += active ? 1 : 0;
    group.deletedSubjects += active ? 0 : 1;
    duplicateGroups.set(key, group);
  }

  const normalizationCollisions = collisionRows.map((row) => {
    const reasons = [
      row.hasLowercaseCode && "lowercase_code",
      row.hasCodeWhitespace && "code_whitespace",
      row.hasNonCanonicalGradeLevel && "noncanonical_grade_level",
      row.hasLowercaseTrackStrand && "lowercase_track_strand",
      row.hasTrackStrandWhitespace && "track_strand_whitespace",
      row.hasBlankTrackStrand && "blank_track_strand",
      row.hasBlankCode && "blank_code",
      row.hasInvalidGradeLevel && "invalid_grade_level",
      row.hasJhsTrackStrand && "jhs_track_strand",
    ].filter(Boolean);

    return {
      id: row.id,
      status: row.deletedAt === null ? "active" : "deleted",
      rawIdentity: {
        code: row.code,
        gradeLevel: row.gradeLevel,
        trackStrand: row.trackStrand,
        trackStrandState: trackStrandState(row.trackStrand),
      },
      normalizedIdentity: {
        code: row.normalizedCode,
        gradeLevel: row.normalizedGradeLevel,
        trackStrand: row.normalizedTrackStrand || null,
      },
      reasons,
    };
  });

  const groups = [...duplicateGroups.values()];
  const activeDuplicateBlockers = groups.filter((group) => group.activeSubjects > 1);
  const archivedDuplicateInformation = groups.filter(
    (group) => group.activeSubjects <= 1 && group.deletedSubjects > 0,
  );
  const invalidActiveSubjects = normalizationCollisions.filter(
    (collision) =>
      collision.status === "active" &&
      collision.reasons.some((reason) =>
        ["blank_code", "invalid_grade_level", "jhs_track_strand"].includes(
          reason as string,
        ),
      ),
  );
  const unchanged = JSON.stringify(before) === JSON.stringify(after);
  const report = {
    audit: "subject-identity",
    readOnly: true,
    normalizedIdentity: "normalizedCode + normalizedGradeLevel + normalizedTrackStrand",
    summary: {
      ...before,
      duplicateIdentityGroups: groups.length,
      activeDuplicateBlockers: activeDuplicateBlockers.length,
      archivedDuplicateInformation: archivedDuplicateInformation.length,
      normalizationCollisions: normalizationCollisions.length,
      invalidActiveSubjects: invalidActiveSubjects.length,
    },
    duplicateIdentityGroups: groups,
    activeDuplicateBlockers,
    archivedDuplicateInformation,
    normalizationCollisions,
    databaseIntegrity: {
      before,
      after,
      unchanged,
    },
  };

  console.log(JSON.stringify(report, null, 2));

  if (!unchanged) {
    process.exitCode = 1;
  } else if (activeDuplicateBlockers.length > 0 || invalidActiveSubjects.length > 0) {
    process.exitCode = 2;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
