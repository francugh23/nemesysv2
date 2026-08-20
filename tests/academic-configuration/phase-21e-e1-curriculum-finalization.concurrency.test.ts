import assert from "node:assert/strict";
import test from "node:test";
import "dotenv/config";
import { Client } from "pg";

async function createClient() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  return client;
}

async function assertWaitsForLock({
  blocker,
  waiter,
  waiterErrorPattern,
}: {
  blocker: (client: Client) => Promise<unknown>;
  waiter: (client: Client) => Promise<unknown>;
  waiterErrorPattern?: RegExp;
}) {
  const blockingClient = await createClient();
  const waitingClient = await createClient();
  try {
    await blockingClient.query("BEGIN");
    await waitingClient.query("BEGIN");
    await blocker(blockingClient);

    let settled = false;
    let waiterError: unknown;
    const waitingOperation = waiter(waitingClient)
      .catch((error) => {
        waiterError = error;
      })
      .finally(() => {
        settled = true;
      });
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(settled, false, "The competing operation should wait for the authoritative row lock.");

    await blockingClient.query("ROLLBACK");
    await waitingOperation;
    if (waiterErrorPattern) {
      assert.ok(waiterError, "Expected the waiting operation to be rejected after the lock was released.");
      assert.match(String(waiterError), waiterErrorPattern);
    } else if (waiterError) {
      throw waiterError;
    }
    await waitingClient.query("ROLLBACK");
  } finally {
    await blockingClient.query("ROLLBACK").catch(() => undefined);
    await waitingClient.query("ROLLBACK").catch(() => undefined);
    await blockingClient.end();
    await waitingClient.end();
  }
}

test("Academic Year locks force Offering edits to revalidate finalized Curriculum", async () => {
  const lookup = await createClient();
  const result = await lookup.query<{ academicYearId: string; offeringId: string }>(`
    SELECT offering."academicYearId", offering."id" AS "offeringId"
    FROM "SubjectOffering" offering
    JOIN "AcademicYear" academic_year ON academic_year."id" = offering."academicYearId"
    JOIN "CurriculumFinalization" finalization
      ON finalization."academicYearId" = academic_year."id"
    WHERE academic_year."status" = 'ACTIVE'
      AND offering."deletedAt" IS NULL
    ORDER BY offering."id"
    LIMIT 1
  `);
  await lookup.end();
  const fixture = result.rows[0];
  assert.ok(fixture);

  await assertWaitsForLock({
    blocker: (client) => client.query(
      `SELECT "id" FROM "AcademicYear" WHERE "id" = $1 FOR UPDATE`,
      [fixture.academicYearId],
    ),
    waiter: (client) => client.query(
      `UPDATE "SubjectOffering" SET "subjectDescription" = "subjectDescription" WHERE "id" = $1`,
      [fixture.offeringId],
    ),
    waiterErrorPattern: /Finalized Curriculum cannot be changed/i,
  });
});

test("finalization and Enrollment materialization serialize without making finalized Curriculum block Enrollment", async () => {
  const lookup = await createClient();
  const result = await lookup.query<{ academicYearId: string; enrollmentId: string; offeringId: string }>(`
    SELECT offering."academicYearId", enrollment."id" AS "enrollmentId",
      offering."id" AS "offeringId"
    FROM "Enrollment" enrollment
    JOIN "Section" section ON section."id" = enrollment."sectionId"
    JOIN "SubjectOffering" offering
      ON offering."academicYearId" = enrollment."academicYearId"
      AND offering."gradeLevel" = section."gradeLevel"
    JOIN "AcademicYear" academic_year ON academic_year."id" = offering."academicYearId"
    JOIN "CurriculumFinalization" finalization
      ON finalization."academicYearId" = academic_year."id"
    LEFT JOIN "SubjectOfferingShsContext" context
      ON context."subjectOfferingId" = offering."id"
    WHERE academic_year."status" = 'ACTIVE'
      AND offering."deletedAt" IS NULL
      AND (context."subjectOfferingId" IS NULL OR context."curriculumStatus" = 'SCHOOL_APPROVED')
      AND NOT EXISTS (
        SELECT 1 FROM "StudentSubjectEnrollment" existing
        WHERE existing."subjectOfferingId" = offering."id"
      )
    ORDER BY offering."id"
    LIMIT 1
  `);
  await lookup.end();
  const fixture = result.rows[0];
  assert.ok(fixture);

  await assertWaitsForLock({
    blocker: (client) => client.query(
      `SELECT "id" FROM "AcademicYear" WHERE "id" = $1 FOR UPDATE`,
      [fixture.academicYearId],
    ),
    waiter: (client) => client.query(
      `INSERT INTO "StudentSubjectEnrollment" (
        "id", "enrollmentId", "subjectOfferingId", "selectionAcademicTermId",
        "subjectCode", "subjectDescription", "gradeLevel", "shsClassification",
        "shsClusterCode", "shsClusterName", "shsCurriculumStatus",
        "shsSourceReference", "shsApprovalReference", "createdById", "updatedAt"
      )
      SELECT $1, enrollment."id", offering."id", enrollment."entryAcademicTermId",
        offering."subjectCode", offering."subjectDescription", offering."gradeLevel",
        context."classification", cluster."code", cluster."name",
        context."curriculumStatus", context."sourceReference",
        context."approvalReference", enrollment."createdById", NOW()
      FROM "Enrollment" enrollment
      JOIN "SubjectOffering" offering ON offering."academicYearId" = enrollment."academicYearId"
      LEFT JOIN "SubjectOfferingShsContext" context
        ON context."subjectOfferingId" = offering."id"
      LEFT JOIN "ShsCurriculumCluster" cluster ON cluster."id" = context."clusterId"
      WHERE enrollment."id" = $2 AND offering."id" = $3`,
      [`phase21e-e1-${Date.now()}`, fixture.enrollmentId, fixture.offeringId],
    ),
  });
});

test("participation locks run before source and SHS snapshot validators", async () => {
  const client = await createClient();
  try {
    const result = await client.query<{ tgname: string }>(`
      SELECT trigger_row.tgname
      FROM pg_trigger trigger_row
      JOIN pg_class table_row ON table_row.oid = trigger_row.tgrelid
      WHERE table_row.relname = 'StudentSubjectEnrollment'
        AND NOT trigger_row.tgisinternal
        AND (trigger_row.tgtype & 2) = 2
        AND (trigger_row.tgtype & 4) = 4
      ORDER BY trigger_row.tgname
    `);
    const relevantNames = result.rows
      .map(({ tgname }) => tgname)
      .filter((name) => name.includes("lock_source_offering") || name.includes("assert_source_year") || name.includes("assert_shs_snapshot"));
    assert.deepEqual(relevantNames, [
      "StudentSubjectEnrollment_00_lock_source_offering_trigger",
      "StudentSubjectEnrollment_assert_shs_snapshot_trigger",
      "StudentSubjectEnrollment_assert_source_year_trigger",
    ]);
  } finally {
    await client.end();
  }
});

test("Offering locks force archive mutation to revalidate finalized Curriculum", async () => {
  const lookup = await createClient();
  const result = await lookup.query<{ id: string }>(`
    SELECT offering."id"
    FROM "SubjectOffering" offering
    JOIN "AcademicYear" academic_year ON academic_year."id" = offering."academicYearId"
    JOIN "CurriculumFinalization" finalization
      ON finalization."academicYearId" = academic_year."id"
    WHERE academic_year."status" = 'ACTIVE'
      AND offering."deletedAt" IS NULL
    ORDER BY offering."id"
    LIMIT 1
  `);
  await lookup.end();
  const offeringId = result.rows[0]?.id;
  assert.ok(offeringId);

  await assertWaitsForLock({
    blocker: (client) => client.query(
      `SELECT "id" FROM "SubjectOffering" WHERE "id" = $1 FOR UPDATE`,
      [offeringId],
    ),
    waiter: (client) => client.query(
      `UPDATE "SubjectOffering" SET "deletedAt" = NOW() WHERE "id" = $1`,
      [offeringId],
    ),
    waiterErrorPattern: /Finalized Curriculum cannot be changed/i,
  });
});

test("participation creation serializes with Offering Term mutation", async () => {
  const lookup = await createClient();
  const result = await lookup.query<{ enrollmentId: string; offeringId: string; academicTermId: string }>(`
    SELECT enrollment."id" AS "enrollmentId", offering."id" AS "offeringId",
      offering_term."academicTermId"
    FROM "Enrollment" enrollment
    JOIN "Section" section ON section."id" = enrollment."sectionId"
    JOIN "SubjectOffering" offering
      ON offering."academicYearId" = enrollment."academicYearId"
      AND offering."gradeLevel" = section."gradeLevel"
    JOIN "AcademicYear" academic_year ON academic_year."id" = offering."academicYearId"
    JOIN "CurriculumFinalization" finalization
      ON finalization."academicYearId" = academic_year."id"
    JOIN "SubjectOfferingTerm" offering_term ON offering_term."subjectOfferingId" = offering."id"
    LEFT JOIN "SubjectOfferingShsContext" context
      ON context."subjectOfferingId" = offering."id"
    WHERE academic_year."status" = 'ACTIVE'
      AND offering."deletedAt" IS NULL
      AND (context."subjectOfferingId" IS NULL OR context."curriculumStatus" = 'SCHOOL_APPROVED')
      AND NOT EXISTS (
        SELECT 1 FROM "StudentSubjectEnrollment" existing
        WHERE existing."subjectOfferingId" = offering."id"
      )
    ORDER BY offering."id", offering_term."academicTermId"
    LIMIT 1
  `);
  await lookup.end();
  const fixture = result.rows[0];
  assert.ok(fixture);

  await assertWaitsForLock({
    blocker: (client) => client.query(
      `INSERT INTO "StudentSubjectEnrollment" (
        "id", "enrollmentId", "subjectOfferingId", "selectionAcademicTermId",
        "subjectCode", "subjectDescription", "gradeLevel", "shsClassification",
        "shsClusterCode", "shsClusterName", "shsCurriculumStatus",
        "shsSourceReference", "shsApprovalReference", "createdById", "updatedAt"
      )
      SELECT $1, enrollment."id", offering."id", enrollment."entryAcademicTermId",
        offering."subjectCode", offering."subjectDescription", offering."gradeLevel",
        context."classification", cluster."code", cluster."name",
        context."curriculumStatus", context."sourceReference",
        context."approvalReference", enrollment."createdById", NOW()
      FROM "Enrollment" enrollment
      JOIN "SubjectOffering" offering ON offering."academicYearId" = enrollment."academicYearId"
      LEFT JOIN "SubjectOfferingShsContext" context
        ON context."subjectOfferingId" = offering."id"
      LEFT JOIN "ShsCurriculumCluster" cluster ON cluster."id" = context."clusterId"
      WHERE enrollment."id" = $2 AND offering."id" = $3`,
      [`phase21e-e1-term-${Date.now()}`, fixture.enrollmentId, fixture.offeringId],
    ),
    waiter: (client) => client.query(
      `DELETE FROM "SubjectOfferingTerm" WHERE "subjectOfferingId" = $1 AND "academicTermId" = $2`,
      [fixture.offeringId, fixture.academicTermId],
    ),
    waiterErrorPattern: /Finalized Curriculum Term applicability|used by student participation/i,
  });
});
