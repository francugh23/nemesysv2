import "dotenv/config";

import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { Client } from "pg";

const SOURCE_DATABASE = "nemesysv2";
const TEMPLATE_DATABASE = "nemesysv2_walkthrough_template";
const TARGET_PREFIX = "nemesysv2_walkthrough_";
const REQUIRED_CONFIRMATION = "CREATE_WALKTHROUGH_DATABASE";
const REQUIRED_TABLES = [
  "User",
  "Teacher",
  "Student",
  "Section",
  "Subject",
  "SubjectAssignment",
  "AcademicYear",
  "AcademicTerm",
  "SubjectOffering",
  "SubjectOfferingTerm",
  "SubjectOfferingShsContext",
  "ShsCurriculumCluster",
  "ShsCurriculumReference",
  "ShsElectiveEnrollmentPolicy",
  "ShsTermResultInterpretationPolicy",
  "CurriculumFinalization",
  "CurriculumCorrection",
  "Enrollment",
  "StudentSubjectEnrollment",
  "StudentSubjectEnrollmentTerm",
  "ShsTermResult",
  "ShsTermResultRevision",
  "Grade",
  "StudentEnrollmentCorrection",
  "StudentEnrollmentGradeCorrection",
  "StudentParticipationCorrection",
  "ShsStudentParticipationCorrection",
  "AuditLog",
] as const;

const TABLE_ORDER: Record<(typeof REQUIRED_TABLES)[number], string> = {
  User: '"id"',
  Teacher: '"id"',
  Student: '"id"',
  Section: '"id"',
  Subject: '"id"',
  SubjectAssignment: '"id"',
  AcademicYear: '"id"',
  AcademicTerm: '"id"',
  SubjectOffering: '"id"',
  SubjectOfferingTerm: '"subjectOfferingId", "academicTermId"',
  SubjectOfferingShsContext: '"subjectOfferingId"',
  ShsCurriculumCluster: '"id"',
  ShsCurriculumReference: '"id"',
  ShsElectiveEnrollmentPolicy: '"id"',
  ShsTermResultInterpretationPolicy: '"id"',
  CurriculumFinalization: '"id"',
  CurriculumCorrection: '"id"',
  Enrollment: '"id"',
  StudentSubjectEnrollment: '"id"',
  StudentSubjectEnrollmentTerm: '"studentSubjectEnrollmentId", "academicTermId"',
  ShsTermResult: '"id"',
  ShsTermResultRevision: '"id"',
  Grade: '"id"',
  StudentEnrollmentCorrection: '"id"',
  StudentEnrollmentGradeCorrection: '"id"',
  StudentParticipationCorrection: '"id"',
  ShsStudentParticipationCorrection: '"id"',
  AuditLog: '"id"',
};

type DatabaseSnapshot = {
  database: string;
  migrations: { count: number; hash: string };
  tables: Record<string, { count: number; hash: string }>;
};

type Arguments = {
  target?: string;
  apply: boolean;
  refreshTemplate: boolean;
  replaceTarget: boolean;
};

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function parseArguments(): Arguments {
  const argumentsList = process.argv.slice(2);
  const targetIndex = argumentsList.indexOf("--target");
  const target = targetIndex === -1 ? undefined : argumentsList[targetIndex + 1];

  if (targetIndex !== -1 && (!target || target.startsWith("--"))) {
    throw new Error("Provide a target name after --target.");
  }

  const known = new Set(["--target", "--apply", "--refresh-template", "--replace-target"]);
  for (const [index, argument] of argumentsList.entries()) {
    if (index === targetIndex + 1) continue;
    if (!known.has(argument)) throw new Error(`Unknown argument: ${argument}`);
  }

  return {
    target,
    apply: argumentsList.includes("--apply"),
    refreshTemplate: argumentsList.includes("--refresh-template"),
    replaceTarget: argumentsList.includes("--replace-target"),
  };
}

function databaseUrl(database: string) {
  const source = new URL(requiredEnvironment("DATABASE_URL"));
  source.pathname = `/${database}`;
  source.search = "";
  return source.toString();
}

function requiredEnvironment(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function assertSafety(argumentsValue: Arguments) {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Refusing database workflow unless NODE_ENV=development.");
  }

  if (process.env.NEMESYS_RESET_CONFIRM !== REQUIRED_CONFIRMATION) {
    throw new Error(`Refusing database workflow unless NEMESYS_RESET_CONFIRM=${REQUIRED_CONFIRMATION}.`);
  }

  const url = new URL(requiredEnvironment("DATABASE_URL"));
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  if (!localHosts.has(url.hostname)) {
    throw new Error(`Refusing unknown database host: ${url.hostname}.`);
  }

  if (url.pathname.slice(1) !== SOURCE_DATABASE) {
    throw new Error(`DATABASE_URL must identify the protected source database ${SOURCE_DATABASE}.`);
  }

  if (!argumentsValue.target) {
    throw new Error("Provide --target nemesysv2_walkthrough_<name>.");
  }

  if (!argumentsValue.target.startsWith(TARGET_PREFIX) || argumentsValue.target === TEMPLATE_DATABASE) {
    throw new Error(`Target must start with ${TARGET_PREFIX} and cannot be the protected template.`);
  }

  if (!/^[a-z0-9_]+$/.test(argumentsValue.target)) {
    throw new Error("Target must contain only lowercase letters, digits, and underscores.");
  }

  if (argumentsValue.refreshTemplate && !argumentsValue.apply) {
    throw new Error("--refresh-template requires --apply.");
  }

  if (argumentsValue.replaceTarget && !argumentsValue.apply) {
    throw new Error("--replace-target requires --apply.");
  }
}

async function withClient<T>(database: string, operation: (client: Client) => Promise<T>) {
  const client = new Client({ connectionString: databaseUrl(database) });
  await client.connect();
  try {
    return await operation(client);
  } finally {
    await client.end();
  }
}

async function databaseExists(database: string) {
  return withClient("postgres", async (client) => {
    const result = await client.query<{ exists: boolean }>("SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS exists", [database]);
    return result.rows[0].exists;
  });
}

async function migrationSnapshot(client: Client) {
  const rows = await client.query<{ id: string; checksum: string; finished_at: Date | null; rolled_back_at: Date | null }>(
    'SELECT "id", "checksum", "finished_at", "rolled_back_at" FROM "_prisma_migrations" ORDER BY "id"',
  );
  if (rows.rows.some((row) => row.finished_at === null && row.rolled_back_at === null)) {
    throw new Error("Refusing database with unfinished Prisma migrations.");
  }
  const applied = rows.rows.filter((row) => row.finished_at !== null && row.rolled_back_at === null);
  const hash = createHash("sha256").update(JSON.stringify(applied)).digest("hex");
  return { count: applied.length, hash };
}

async function snapshotDatabase(database: string): Promise<DatabaseSnapshot> {
  return withClient(database, async (client) => {
    const migrations = await migrationSnapshot(client);
    const tables: DatabaseSnapshot["tables"] = {};

    for (const table of REQUIRED_TABLES) {
      const result = await client.query<{ row: unknown }>(
        `SELECT row_to_json(record) AS row FROM ${quoteIdentifier(table)} AS record ORDER BY ${TABLE_ORDER[table]}`,
      );
      tables[table] = {
        count: result.rows.length,
        hash: createHash("sha256").update(JSON.stringify(result.rows)).digest("hex"),
      };
    }

    return { database, migrations, tables };
  });
}

async function assertSchemaIdentity(database: string, sourceMigrations: DatabaseSnapshot["migrations"]) {
  await withClient(database, async (client) => {
    const existing = await client.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
    );
    const names = new Set(existing.rows.map((row) => row.table_name));
    for (const table of REQUIRED_TABLES) {
      if (!names.has(table)) throw new Error(`Refusing ${database}: required table ${table} is missing.`);
    }

    const migrations = await migrationSnapshot(client);
    if (migrations.count !== sourceMigrations.count || migrations.hash !== sourceMigrations.hash) {
      throw new Error(`Refusing ${database}: Prisma migration identity does not match ${SOURCE_DATABASE}.`);
    }
  });
}

function runDockerPipe(sourceArguments: string[], targetArguments: string[]) {
  const container = process.env.NEMESYS_POSTGRES_CONTAINER ?? "nemesysv2-postgres";
  const source = spawn("docker", ["exec", container, ...sourceArguments], { stdio: ["ignore", "pipe", "pipe"] });
  const target = spawn("docker", ["exec", "-i", container, ...targetArguments], { stdio: ["pipe", "pipe", "pipe"] });
  source.stdout.pipe(target.stdin);

  return new Promise<void>((resolve, reject) => {
    let errors = "";
    let sourceExitCode: number | null = null;
    let targetExitCode: number | null = null;
    const complete = () => {
      if (sourceExitCode === null || targetExitCode === null) return;
      if (sourceExitCode === 0 && targetExitCode === 0) resolve();
      else reject(new Error(`Docker PostgreSQL transfer failed: ${errors.trim()}`));
    };
    source.stderr.on("data", (chunk) => { errors += chunk.toString(); });
    target.stderr.on("data", (chunk) => { errors += chunk.toString(); });
    source.on("error", reject);
    target.on("error", reject);
    source.on("close", (code) => { sourceExitCode = code; complete(); });
    target.on("close", (code) => { targetExitCode = code; complete(); });
  });
}

async function copyTable(table: string) {
  const rows = await withClient(SOURCE_DATABASE, async (client) => {
    const result = await client.query<Record<string, unknown>>(`SELECT * FROM ${quoteIdentifier(table)}`);
    return result.rows;
  });
  if (rows.length === 0) return;

  const columns = Object.keys(rows[0]);
  const columnList = columns.map(quoteIdentifier).join(", ");
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
  const statement = `INSERT INTO ${quoteIdentifier(table)} (${columnList}) VALUES (${placeholders})`;

  await withClient(TEMPLATE_DATABASE, async (client) => {
    for (const row of rows) {
      await client.query(statement, columns.map((column) => row[column]));
    }
  });
}

async function createDatabase(database: string, template = "template0") {
  await withClient("postgres", async (client) => {
    await client.query(`CREATE DATABASE ${quoteIdentifier(database)} WITH TEMPLATE ${quoteIdentifier(template)}`);
  });
}

async function dropTargetDatabase(database: string) {
  await withClient("postgres", async (client) => {
    await client.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()", [database]);
    await client.query(`DROP DATABASE ${quoteIdentifier(database)}`);
  });
}

async function buildTemplate(sourceSnapshot: DatabaseSnapshot) {
  if (await databaseExists(TEMPLATE_DATABASE)) {
    await dropTargetDatabase(TEMPLATE_DATABASE);
  }

  await createDatabase(TEMPLATE_DATABASE);
  const username = new URL(requiredEnvironment("DATABASE_URL")).username;
  if (!username) throw new Error("DATABASE_URL must include a PostgreSQL username.");

  await runDockerPipe(
    ["pg_dump", "-U", username, "--schema-only", "--no-owner", "--no-privileges", SOURCE_DATABASE],
    ["psql", "-v", "ON_ERROR_STOP=1", "-U", username, "-d", TEMPLATE_DATABASE],
  );

  for (const table of ["_prisma_migrations", "User", "Teacher", "Subject", "ShsCurriculumCluster", "ShsCurriculumReference"] as const) await copyTable(table);

  await withClient(TEMPLATE_DATABASE, async (client) => {
    await client.query(
      'DELETE FROM "Subject" WHERE "gradeLevel" IN (\'11\', \'12\') AND NOT EXISTS (SELECT 1 FROM "ShsCurriculumReference" WHERE "ShsCurriculumReference"."subjectId" = "Subject"."id")',
    );
  });

  await assertSchemaIdentity(TEMPLATE_DATABASE, sourceSnapshot.migrations);
}

function expectedCounts() {
  return {
    User: 6,
    Teacher: 3,
    Subject: 203,
    ShsCurriculumCluster: 16,
    ShsCurriculumReference: 171,
  };
}

function assertBaseline(snapshot: DatabaseSnapshot) {
  const expected = expectedCounts();
  for (const table of REQUIRED_TABLES) {
    const count = snapshot.tables[table].count;
    const expectedCount = expected[table as keyof typeof expected] ?? 0;
    if (count !== expectedCount) {
      throw new Error(`Baseline ${snapshot.database} has ${count} ${table} rows; expected ${expectedCount}.`);
    }
  }
}

function printPlan(source: DatabaseSnapshot, argumentsValue: Arguments) {
  const customShsSubjects = source.tables.Subject.count - 203;
  console.log(JSON.stringify({
    mode: argumentsValue.apply ? "apply" : "dry-run",
    sourceDatabase: SOURCE_DATABASE,
    templateDatabase: TEMPLATE_DATABASE,
    targetDatabase: argumentsValue.target,
    migrations: source.migrations,
    sourceCounts: Object.fromEntries(Object.entries(source.tables).map(([table, value]) => [table, value.count])),
    customShsSubjectsExcluded: customShsSubjects,
    expectedTemplateCounts: expectedCounts(),
    expectedTargetCounts: expectedCounts(),
    expectedZeroTables: REQUIRED_TABLES.filter((table) => !(table in expectedCounts())),
    safety: {
      nodeEnv: process.env.NODE_ENV,
      sourceHost: new URL(requiredEnvironment("DATABASE_URL")).hostname,
      confirmation: "accepted",
      targetPrefix: TARGET_PREFIX,
      triggersOrFksDisabled: false,
      truncateCascadeUsed: false,
      dropSchemaUsed: false,
      migrationHistoryEdited: false,
    },
  }, null, 2));
}

async function main() {
  const argumentsValue = parseArguments();
  assertSafety(argumentsValue);
  const sourceBefore = await snapshotDatabase(SOURCE_DATABASE);
  await assertSchemaIdentity(SOURCE_DATABASE, sourceBefore.migrations);
  printPlan(sourceBefore, argumentsValue);

  if (!argumentsValue.apply) return;

  if (argumentsValue.refreshTemplate) {
    await buildTemplate(sourceBefore);
  } else if (!(await databaseExists(TEMPLATE_DATABASE))) {
    throw new Error(`Protected template ${TEMPLATE_DATABASE} does not exist. Re-run with --refresh-template.`);
  }

  const templateSnapshot = await snapshotDatabase(TEMPLATE_DATABASE);
  assertBaseline(templateSnapshot);
  await assertSchemaIdentity(TEMPLATE_DATABASE, sourceBefore.migrations);

  if (await databaseExists(argumentsValue.target!)) {
    if (!argumentsValue.replaceTarget) {
      throw new Error(`Target ${argumentsValue.target} already exists. Re-run with --replace-target to replace only that prefixed target.`);
    }
    await dropTargetDatabase(argumentsValue.target!);
  }

  await createDatabase(argumentsValue.target!, TEMPLATE_DATABASE);
  const targetSnapshot = await snapshotDatabase(argumentsValue.target!);
  assertBaseline(targetSnapshot);
  await assertSchemaIdentity(argumentsValue.target!, sourceBefore.migrations);

  const sourceAfter = await snapshotDatabase(SOURCE_DATABASE);
  if (JSON.stringify(sourceBefore) !== JSON.stringify(sourceAfter)) {
    throw new Error(`Source database ${SOURCE_DATABASE} changed during template creation.`);
  }

  console.log(JSON.stringify({
    template: templateSnapshot,
    target: targetSnapshot,
    sourceIntegrity: "unchanged",
    superAdminPreserved: targetSnapshot.tables.User.hash === sourceBefore.tables.User.hash,
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
