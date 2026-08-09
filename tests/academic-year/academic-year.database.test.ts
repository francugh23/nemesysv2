import assert from "node:assert/strict";
import test from "node:test";

import pg from "pg";

const connectionString = process.env.ACADEMIC_YEAR_TEST_DATABASE_URL;

test(
  "PostgreSQL permits exactly one concurrent Academic Year activation",
  { skip: !connectionString },
  async () => {
    assert.ok(connectionString);
    const { Client } = pg;

    async function activate(id: string) {
      const client = new Client({ connectionString });
      await client.connect();

      try {
        await client.query("BEGIN");
        await client.query(
          'UPDATE "AcademicYear" SET "status" = \'ACTIVE\' WHERE "id" = $1',
          [id],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        await client.end();
      }
    }

    const results = await Promise.allSettled([
      activate("activation-a"),
      activate("activation-b"),
    ]);
    const verifier = new Client({ connectionString });
    await verifier.connect();
    const active = await verifier.query<{ id: string }>(
      'SELECT "id" FROM "AcademicYear" WHERE "status" = \'ACTIVE\'',
    );
    await verifier.end();

    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(active.rowCount, 1);
  },
);

test(
  "Academic Year mutation rolls back when its audit write fails",
  { skip: !connectionString },
  async () => {
    assert.ok(connectionString);
    const { Client } = pg;
    const client = new Client({ connectionString });
    await client.connect();

    await client.query(
      `INSERT INTO "AcademicYear" (
        "id", "label", "startDate", "endDate", "status", "updatedAt"
      ) VALUES (
        'audit-atomicity', '2030-2031', DATE '2030-06-01', DATE '2031-04-01',
        'DRAFT', CURRENT_TIMESTAMP
      )`,
    );

    await client.query("BEGIN");

    try {
      await client.query(
        `UPDATE "AcademicYear"
         SET "status" = 'ARCHIVED'
         WHERE "id" = 'audit-atomicity'`,
      );
      await client.query(
        `INSERT INTO "AuditLog" (
          "id", "userId", "action", "module", "recordId", "description"
        ) VALUES (
          'failing-audit', 'missing-actor', 'ARCHIVE', 'AcademicYear',
          'audit-atomicity', 'Must fail'
        )`,
      );
      await client.query("COMMIT");
      assert.fail("Audit write unexpectedly succeeded");
    } catch {
      await client.query("ROLLBACK");
    }

    const result = await client.query<{ status: string }>(
      `SELECT "status" FROM "AcademicYear" WHERE "id" = 'audit-atomicity'`,
    );
    assert.equal(result.rows[0]?.status, "DRAFT");

    await client.query(
      `DELETE FROM "AcademicYear" WHERE "id" = 'audit-atomicity'`,
    );
    await client.end();
  },
);
