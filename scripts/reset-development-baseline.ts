import "dotenv/config";

import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { Client } from "pg";

const SOURCE_DATABASE = "nemesysv2";
const CONTAINER = process.env.NEMESYS_POSTGRES_CONTAINER ?? "nemesysv2-postgres";
const APPLY_CONFIRMATION = "RESET_NEMESYSV2_TO_PHASE22C_BASELINE";
const ROLLBACK_CONFIRMATION = "ROLLBACK_NEMESYSV2_PHASE22C_BASELINE";
const JHS_SUBJECT_COUNT = 32;

const tables = [
  ["User", '"id"'], ["Teacher", '"id"'], ["Student", '"id"'], ["Section", '"id"'],
  ["Subject", '"id"'], ["SubjectAssignment", '"id"'], ["AcademicYear", '"id"'], ["AcademicTerm", '"id"'],
  ["SubjectOffering", '"id"'], ["SubjectOfferingTerm", '"subjectOfferingId", "academicTermId"'],
  ["SubjectOfferingShsContext", '"subjectOfferingId"'], ["ShsCurriculumCluster", '"id"'],
  ["ShsCurriculumReference", '"id"'], ["ShsElectiveEnrollmentPolicy", '"id"'],
  ["ShsTermResultInterpretationPolicy", '"id"'], ["CurriculumFinalization", '"id"'],
  ["CurriculumCorrection", '"id"'], ["Enrollment", '"id"'], ["StudentSubjectEnrollment", '"id"'],
  ["StudentSubjectEnrollmentTerm", '"studentSubjectEnrollmentId", "academicTermId"'], ["ShsTermResult", '"id"'],
  ["ShsTermResultRevision", '"id"'], ["Grade", '"id"'], ["StudentEnrollmentCorrection", '"id"'],
  ["StudentEnrollmentGradeCorrection", '"id"'], ["StudentParticipationCorrection", '"id"'],
  ["ShsStudentParticipationCorrection", '"id"'], ["AuditLog", '"id"'],
] as const;

type Table = (typeof tables)[number][0];
type Arguments = { apply: boolean; removeCuratedElectives: boolean; rollbackDb?: string; rollbackFingerprint?: string; superAdminId?: string };
type Snapshot = { database: string; migrations: { count: number; hash: string }; schemaHash: string; databaseAclHash: string; tables: Record<Table, { count: number; hash: string }> };

const clusters = [
  ["ACA-ASSH", "Arts, Social Science, and Humanities", "ACADEMIC"],
  ["ACA-BE", "Business and Entrepreneurship", "ACADEMIC"],
  ["ACA-ICT", "ICT Support and Computer Programming Technologies", "ACADEMIC"],
  ["ACA-STEM", "Science, Technology, Engineering, and Mathematics", "ACADEMIC"],
  ["TP-ASET", "Automotive and Small Engine Technologies", "TECHPRO"],
  ["TP-CBT", "Construction and Building Technology", "TECHPRO"],
  ["TP-CADT", "Creative Arts and Design Technology", "TECHPRO"],
  ["TP-HT", "Hospitality and Tourism", "TECHPRO"],
] as const;

const coreSubjects = [
  ["SSHS-G11-CORE-01", "Effective Communication"],
  ["SSHS-G11-CORE-02", "Life and Career Skills"],
  ["SSHS-G11-CORE-03", "General Mathematics"],
  ["SSHS-G11-CORE-04", "General Science"],
  ["SSHS-G11-CORE-05", "Philippine History and Society"],
] as const;

const curatedElectiveCodes = [
  "SSHS-G11-ACA-ASSH-01", "SSHS-G11-ACA-ASSH-02", "SSHS-G11-ACA-BE-01", "SSHS-G11-ACA-BE-02",
  "SSHS-G11-ACA-ICT-01", "SSHS-G11-ACA-ICT-02", "SSHS-G11-ACA-STEM-01", "SSHS-G11-ACA-STEM-02",
  "SSHS-G11-TP-ASET-01", "SSHS-G11-TP-ASET-02", "SSHS-G11-TP-CBT-01", "SSHS-G11-TP-CBT-02",
  "SSHS-G11-TP-CADT-01", "SSHS-G11-TP-CADT-02", "SSHS-G11-TP-HT-01", "SSHS-G11-TP-HT-02",
] as const;

function hash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function fingerprint(snapshot: Snapshot) { return hash({ migrations: snapshot.migrations, schemaHash: snapshot.schemaHash, databaseAclHash: snapshot.databaseAclHash, tables: snapshot.tables }); }
function normalizedSchema(dump: Buffer) {
  // pg_restore reparses equivalent CHECK expressions and may change grouping parentheses.
  return dump.toString().replace(/^\\(?:un)?restrict\s+\S+\s*$/gm, "").replace(/^-- Database:.*$/gm, "").replace(/^\\connect\s+.*$/gm, "").replace(/[()\s]/g, "");
}
function schemaFingerprint(dump: Buffer) {
  // PostgreSQL 17 emits a random \restrict token in every pg_dump; it is not schema state.
  return hash(normalizedSchema(dump));
}
function quote(value: string) { return `"${value.replaceAll('"', '""')}"`; }
function required(name: string) { const value = process.env[name]; if (!value) throw new Error(`${name} is required.`); return value; }
function databaseUrl(database: string) { const url = new URL(required("DATABASE_URL")); url.pathname = `/${database}`; url.search = ""; return url.toString(); }
function timestamp() { return new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 14); }

function parseArguments(): Arguments {
  const values = process.argv.slice(2);
  const allowed = new Set(["--apply", "--remove-curated-electives", "--super-admin-id", "--rollback-db", "--rollback-fingerprint"]);
  for (const [index, value] of values.entries()) {
    if (!allowed.has(value) && !["--super-admin-id", "--rollback-db", "--rollback-fingerprint"].includes(values[index - 1] ?? "")) throw new Error(`Unknown argument: ${value}`);
  }
  const read = (flag: string) => { const index = values.indexOf(flag); const value = index === -1 ? undefined : values[index + 1]; if (index !== -1 && (!value || value.startsWith("--"))) throw new Error(`${flag} requires a value.`); return value; };
  const result = { apply: values.includes("--apply"), removeCuratedElectives: values.includes("--remove-curated-electives"), superAdminId: read("--super-admin-id"), rollbackDb: read("--rollback-db"), rollbackFingerprint: read("--rollback-fingerprint") };
  if (result.removeCuratedElectives && (result.superAdminId || result.rollbackDb || result.rollbackFingerprint)) throw new Error("Curated elective removal cannot include reset or rollback arguments.");
  if (result.rollbackDb && result.superAdminId) throw new Error("Rollback mode cannot include --super-admin-id.");
  if (!result.removeCuratedElectives && !result.rollbackDb && !result.superAdminId) throw new Error("Provide --super-admin-id for reset mode.");
  if (result.rollbackDb && !result.rollbackFingerprint) throw new Error("Rollback mode requires --rollback-fingerprint from the reset output.");
  return result;
}

function assertSafety(argumentsValue: Arguments) {
  if (process.env.NODE_ENV !== "development") throw new Error("Refusing unless NODE_ENV=development.");
  const url = new URL(required("DATABASE_URL"));
  if (!new Set(["localhost", "127.0.0.1", "::1"]).has(url.hostname)) throw new Error(`Refusing unknown database host: ${url.hostname}.`);
  if (url.pathname.slice(1) !== SOURCE_DATABASE) throw new Error(`DATABASE_URL must name exactly ${SOURCE_DATABASE}.`);
  const confirmation = argumentsValue.rollbackDb ? ROLLBACK_CONFIRMATION : APPLY_CONFIRMATION;
  if (process.env.NEMESYS_RESET_CONFIRM !== confirmation) throw new Error(`Set NEMESYS_RESET_CONFIRM=${confirmation}.`);
  if (argumentsValue.rollbackDb && !/^nemesysv2_phase22c_rollback_\d{14}$/.test(argumentsValue.rollbackDb)) throw new Error("Rollback database name is invalid.");
}

async function withClient<T>(database: string, operation: (client: Client) => Promise<T>) {
  const client = new Client({ connectionString: databaseUrl(database) }); await client.connect();
  try { return await operation(client); } finally { await client.end(); }
}

function run(command: string, argumentsValue: string[], input?: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    const processValue = spawn(command, argumentsValue, { stdio: [input ? "pipe" : "ignore", "pipe", "pipe"] }); const output: Buffer[] = []; const errors: Buffer[] = [];
    processValue.stdout?.on("data", (value) => output.push(value)); processValue.stderr?.on("data", (value) => errors.push(value)); processValue.on("error", reject);
    processValue.on("close", (code) => code === 0 ? resolve(Buffer.concat(output)) : reject(new Error(`${command} failed: ${Buffer.concat(errors).toString().trim()}`)));
    if (input) processValue.stdin?.end(input);
  });
}

async function assertDocker() {
  const running = (await run("docker", ["inspect", "--format", "{{.State.Running}}", CONTAINER])).toString().trim();
  if (running !== "true") throw new Error(`Docker container ${CONTAINER} is not running.`);
}

async function schemaDump(database: string) {
  const username = new URL(required("DATABASE_URL")).username; if (!username) throw new Error("DATABASE_URL must include a PostgreSQL username.");
  return run("docker", ["exec", CONTAINER, "pg_dump", "-U", username, "--schema-only", database]);
}

async function restoreSchema(database: string, dump: Buffer) {
  const username = new URL(required("DATABASE_URL")).username;
  await run("docker", ["exec", "-i", CONTAINER, "psql", "-v", "ON_ERROR_STOP=1", "-U", username, "-d", database], dump);
}

async function migrationSnapshot(client: Client) {
  const result = await client.query('SELECT "id", "checksum", "finished_at", "rolled_back_at" FROM "_prisma_migrations" ORDER BY "id"');
  if (result.rows.some((row) => row.finished_at === null && row.rolled_back_at === null)) throw new Error("Refusing database with unfinished migrations.");
  const applied = result.rows.filter((row) => row.finished_at !== null && row.rolled_back_at === null);
  return { count: applied.length, hash: hash(applied) };
}

async function snapshot(database: string): Promise<Snapshot> {
  const dump = await schemaDump(database);
  return withClient(database, async (client) => {
    const snapshots = {} as Snapshot["tables"];
    for (const [table, order] of tables) {
      const rows = await client.query(`SELECT row_to_json(record) AS row FROM ${quote(table)} record ORDER BY ${order}`);
      snapshots[table] = { count: rows.rows.length, hash: hash(rows.rows) };
    }
    const acl = await client.query("SELECT COALESCE(grantee::regrole::text, 'PUBLIC') AS grantee, privilege_type, is_grantable FROM pg_database CROSS JOIN LATERAL aclexplode(COALESCE(datacl, acldefault('d', datdba))) WHERE datname = current_database() ORDER BY 1, 2, 3");
    return { database, migrations: await migrationSnapshot(client), schemaHash: schemaFingerprint(dump), databaseAclHash: hash(acl.rows), tables: snapshots };
  });
}

async function databaseExists(database: string) { return withClient("postgres", async (client) => (await client.query("SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS exists", [database])).rows[0].exists as boolean); }
async function databaseOwner() { return withClient(SOURCE_DATABASE, async (client) => (await client.query("SELECT pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname = current_database()")).rows[0].owner as string); }
async function createDatabase(database: string, owner: string) { await withClient("postgres", (client) => client.query(`CREATE DATABASE ${quote(database)} WITH TEMPLATE template0 OWNER ${quote(owner)}`)); }
async function copyDatabaseGrants(database: string) {
  const grants = await withClient(SOURCE_DATABASE, async (client) => (await client.query("SELECT COALESCE(grantee::regrole::text, 'PUBLIC') AS grantee, privilege_type, is_grantable FROM pg_database CROSS JOIN LATERAL aclexplode(datacl) WHERE datname = current_database() ORDER BY 1, 2, 3")).rows as Array<{ grantee: string; privilege_type: string; is_grantable: boolean }>);
  await withClient("postgres", async (client) => {
    for (const grant of grants) await client.query(`GRANT ${grant.privilege_type} ON DATABASE ${quote(database)} TO ${grant.grantee === "PUBLIC" ? "PUBLIC" : quote(grant.grantee)}${grant.is_grantable ? " WITH GRANT OPTION" : ""}`);
  });
}
async function renameDatabase(from: string, to: string) { await withClient("postgres", (client) => client.query(`ALTER DATABASE ${quote(from)} RENAME TO ${quote(to)}`)); }
async function terminateConnections(database: string) { await withClient("postgres", (client) => client.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()", [database])); }
async function dropCandidate(database: string) { if (await databaseExists(database)) { await terminateConnections(database); await withClient("postgres", (client) => client.query(`DROP DATABASE ${quote(database)}`)); } }

async function fetchRows(database: string, sql: string, parameters: unknown[] = []) { return withClient(database, async (client) => (await client.query<Record<string, unknown>>(sql, parameters)).rows); }
async function insertRows(database: string, table: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const columns = Object.keys(rows[0]); const statement = `INSERT INTO ${quote(table)} (${columns.map(quote).join(", ")}) VALUES (${columns.map((_, index) => `$${index + 1}`).join(", ")})`;
  await withClient(database, async (client) => { for (const row of rows) await client.query(statement, columns.map((column) => row[column])); });
}

async function selectedAdmin(id: string) {
  const rows = await fetchRows(SOURCE_DATABASE, 'SELECT * FROM "User" WHERE "id" = $1 AND "role" = \'SUPER_ADMIN\' AND "status" = \'ACTIVE\' AND "deletedAt" IS NULL', [id]);
  if (rows.length !== 1) throw new Error("Selected User must be one ACTIVE, non-deleted SUPER_ADMIN.");
  return rows[0];
}

function curatedSubjects(createdById: string) {
  const now = new Date();
  return coreSubjects.map(([code, description]) => ({ id: randomUUID(), code, description, gradeLevel: "11", trackStrand: null, semester: null, createdById, createdAt: now, updatedAt: now, deletedAt: null }));
}
function curatedClusters(createdById: string) {
  const now = new Date();
  return clusters.map(([code, name, track]) => ({ id: randomUUID(), code, name, track, sourceReference: "Phase 22C curated development baseline", isSchoolFacing: true, createdById, createdAt: now, updatedAt: now, deletedAt: null }));
}

function expectedCounts() {
  return Object.fromEntries(tables.map(([table]) => [table, 0])) as Record<Table, number> & { Subject: number; User: number; ShsCurriculumCluster: number };
}

async function assertCandidate(database: string, source: Snapshot, admin: Record<string, unknown>, jhsCount: number) {
  const candidate = await snapshot(database); const expected = expectedCounts();
  expected.User = 1; expected.Subject = jhsCount + coreSubjects.length; expected.ShsCurriculumCluster = clusters.length;
  if (candidate.migrations.count !== source.migrations.count || candidate.migrations.hash !== source.migrations.hash) throw new Error("Candidate migration identity differs from source.");
  if (candidate.schemaHash !== source.schemaHash || candidate.databaseAclHash !== source.databaseAclHash) {
    throw new Error(`Candidate schema or database ACL fingerprint differs from source (schema ${source.schemaHash}/${candidate.schemaHash}; ACL ${source.databaseAclHash}/${candidate.databaseAclHash}).`);
  }
  for (const [table] of tables) if (candidate.tables[table].count !== expected[table]) throw new Error(`Candidate has ${candidate.tables[table].count} ${table} rows; expected ${expected[table]}.`);
  const copiedAdmin = await fetchRows(database, 'SELECT * FROM "User" WHERE "id" = $1', [admin.id]);
  if (copiedAdmin.length !== 1 || hash(copiedAdmin[0]) !== hash(admin)) throw new Error("Candidate Super Admin does not exactly match source.");
  const candidateClusters = await fetchRows(database, 'SELECT "code" FROM "ShsCurriculumCluster" WHERE "deletedAt" IS NULL ORDER BY "code"');
  if (hash(candidateClusters) !== hash([...clusters].map(([code]) => ({ code })).sort((a, b) => a.code.localeCompare(b.code)))) throw new Error("Candidate cluster codes differ from the approved baseline.");
  return candidate;
}

async function buildCandidate(candidate: string, source: Snapshot, admin: Record<string, unknown>) {
  const owner = await databaseOwner(); const dump = await schemaDump(SOURCE_DATABASE); await createDatabase(candidate, owner);
  try {
    await copyDatabaseGrants(candidate);
    await restoreSchema(candidate, dump);
    await insertRows(candidate, "_prisma_migrations", await fetchRows(SOURCE_DATABASE, 'SELECT * FROM "_prisma_migrations" ORDER BY "id"'));
    await insertRows(candidate, "User", [admin]);
    const jhs = await fetchRows(SOURCE_DATABASE, 'SELECT * FROM "Subject" WHERE "gradeLevel" IN (\'7\', \'8\', \'9\', \'10\') AND "deletedAt" IS NULL ORDER BY "id"');
    if (jhs.length !== JHS_SUBJECT_COUNT) throw new Error(`Expected ${JHS_SUBJECT_COUNT} active Grade 7-10 Subjects; found ${jhs.length}.`);
    await insertRows(candidate, "Subject", jhs.map((subject) => ({ ...subject, createdById: admin.id })));
    await insertRows(candidate, "ShsCurriculumCluster", curatedClusters(String(admin.id)));
    await insertRows(candidate, "Subject", curatedSubjects(String(admin.id)));
    return await assertCandidate(candidate, source, admin, jhs.length);
  } catch (error) { await dropCandidate(candidate); throw error; }
}

function printPlan(source: Snapshot, candidate: string, admin: Record<string, unknown>, rollback?: string) {
  console.log(JSON.stringify({ mode: "dry-run", sourceDatabase: SOURCE_DATABASE, candidateDatabase: candidate, rollbackDatabase: rollback, selectedSuperAdmin: { id: admin.id, username: admin.username, email: admin.email }, sourceCounts: Object.fromEntries(tables.map(([table]) => [table, source.tables[table].count])), expected: { users: 1, jhsSubjects: JHS_SUBJECT_COUNT, grade11CoreSubjects: coreSubjects.length, grade11Electives: 0, subjects: JHS_SUBJECT_COUNT + coreSubjects.length, clusters: clusters.map(([code]) => code), zeroTables: tables.map(([table]) => table).filter((table) => !["User", "Subject", "ShsCurriculumCluster"].includes(table)) }, migrations: source.migrations, schemaHash: source.schemaHash, databaseAclHash: source.databaseAclHash, safety: { triggersOrFksDisabled: false, truncateCascadeUsed: false, dropSchemaUsed: false, migrationHistoryEdited: false, sourceRowsDeletedInPlace: false } }, null, 2));
}

async function removeCuratedElectives(argumentsValue: Arguments) {
  const candidates = await fetchRows(SOURCE_DATABASE, 'SELECT "id", "code" FROM "Subject" WHERE "code" = ANY($1::text[]) ORDER BY "code"', [curatedElectiveCodes]);
  if (candidates.length !== curatedElectiveCodes.length || hash(candidates.map((candidate) => candidate.code)) !== hash([...curatedElectiveCodes].sort())) throw new Error("The current database does not contain exactly the curated Phase 22C elective Subjects.");
  const references = await fetchRows(SOURCE_DATABASE, "SELECT conrelid::regclass::text AS table_name, attname AS column_name FROM pg_constraint JOIN pg_attribute ON attrelid = conrelid AND attnum = ANY(conkey) WHERE contype = 'f' AND confrelid = '\"Subject\"'::regclass ORDER BY 1, 2");
  const dependencies: Array<{ table: string; column: string; count: number }> = [];
  for (const reference of references) {
    const count = await fetchRows(SOURCE_DATABASE, `SELECT count(*)::int AS count FROM ${String(reference.table_name)} WHERE ${quote(String(reference.column_name))} = ANY($1::text[])`, [candidates.map((candidate) => candidate.id)]);
    if (Number(count[0].count) > 0) dependencies.push({ table: String(reference.table_name), column: String(reference.column_name), count: Number(count[0].count) });
  }
  console.log(JSON.stringify({ mode: "curated-elective-removal-dry-run", candidates, dependencies }, null, 2));
  if (dependencies.length) throw new Error("Refusing curated elective deletion because dependent references exist.");
  if (!argumentsValue.apply) return;
  await withClient(SOURCE_DATABASE, async (client) => {
    await client.query("BEGIN");
    try {
      const deleted = await client.query('DELETE FROM "Subject" WHERE "id" = ANY($1::text[]) AND "code" = ANY($2::text[])', [candidates.map((candidate) => candidate.id), curatedElectiveCodes]);
      if (deleted.rowCount !== curatedElectiveCodes.length) throw new Error(`Deleted ${deleted.rowCount} curated elective Subjects; expected ${curatedElectiveCodes.length}.`);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
  const remaining = await fetchRows(SOURCE_DATABASE, 'SELECT count(*)::int AS count FROM "Subject" WHERE "code" = ANY($1::text[])', [curatedElectiveCodes]);
  if (Number(remaining[0].count) !== 0) throw new Error("Curated elective deletion verification failed.");
  console.log(JSON.stringify({ mode: "curated-elective-removal-applied", deletedSubjects: curatedElectiveCodes.length }, null, 2));
}

async function reset(argumentsValue: Arguments) {
  const admin = await selectedAdmin(argumentsValue.superAdminId!); const source = await snapshot(SOURCE_DATABASE); const suffix = timestamp(); const candidate = `nemesysv2_phase22c_candidate_${suffix}`; const rollback = `nemesysv2_phase22c_rollback_${suffix}`;
  printPlan(source, candidate, admin, rollback); if (!argumentsValue.apply) return;
  await buildCandidate(candidate, source, admin);
  const sourceAfter = await snapshot(SOURCE_DATABASE); if (fingerprint(sourceAfter) !== fingerprint(source)) { await dropCandidate(candidate); throw new Error("Source changed while the candidate was built."); }
  try {
    await terminateConnections(SOURCE_DATABASE); await renameDatabase(SOURCE_DATABASE, rollback); await renameDatabase(candidate, SOURCE_DATABASE);
    await assertCandidate(SOURCE_DATABASE, source, admin, JHS_SUBJECT_COUNT);
    const preserved = await snapshot(rollback); if (fingerprint(preserved) !== fingerprint(source)) throw new Error("Rollback database does not match the original source snapshot.");
    const final = await snapshot(SOURCE_DATABASE);
    console.log(JSON.stringify({ mode: "applied", database: SOURCE_DATABASE, rollbackDatabase: rollback, rollbackFingerprint: fingerprint(source), finalCounts: Object.fromEntries(tables.map(([table]) => [table, final.tables[table].count])) }, null, 2));
  } catch (error) {
    if (await databaseExists(rollback) && await databaseExists(SOURCE_DATABASE)) { const failed = `nemesysv2_phase22c_failed_${suffix}`; await terminateConnections(SOURCE_DATABASE); await renameDatabase(SOURCE_DATABASE, failed); await renameDatabase(rollback, SOURCE_DATABASE); await dropCandidate(failed); }
    throw error;
  }
}

async function rollback(argumentsValue: Arguments) {
  const rollbackDb = argumentsValue.rollbackDb!; const current = await snapshot(SOURCE_DATABASE); const preserved = await snapshot(rollbackDb);
  if (fingerprint(preserved) !== argumentsValue.rollbackFingerprint) throw new Error("Rollback database fingerprint does not match the supplied reset fingerprint.");
  console.log(JSON.stringify({ mode: "rollback-dry-run", database: SOURCE_DATABASE, rollbackDatabase: rollbackDb, currentBaselineFingerprint: fingerprint(current), rollbackFingerprint: fingerprint(preserved) }, null, 2));
  if (!argumentsValue.apply) return;
  const displaced = `nemesysv2_phase22c_reverted_${timestamp()}`;
  await terminateConnections(SOURCE_DATABASE); await renameDatabase(SOURCE_DATABASE, displaced); await renameDatabase(rollbackDb, SOURCE_DATABASE);
  if (fingerprint(await snapshot(SOURCE_DATABASE)) !== fingerprint(preserved)) throw new Error("Rollback verification failed.");
  console.log(JSON.stringify({ mode: "rolled-back", database: SOURCE_DATABASE, displacedBaselineDatabase: displaced }, null, 2));
}

async function main() { const argumentsValue = parseArguments(); assertSafety(argumentsValue); await assertDocker(); if (argumentsValue.removeCuratedElectives) await removeCuratedElectives(argumentsValue); else if (argumentsValue.rollbackDb) await rollback(argumentsValue); else await reset(argumentsValue); }
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
