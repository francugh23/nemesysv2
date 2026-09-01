# Phase 22C: Development Baseline Reset

## Scope

Phase 22C replaces the exact local development database `nemesysv2` through a validated candidate build and atomic database-name swap. It never deletes protected history from the source in place.

## Tooling

`npm run reset:development-baseline` is a dedicated development-only command. It requires:

- `NODE_ENV=development`
- `DATABASE_URL` for exact local database `nemesysv2`
- localhost, `127.0.0.1`, or `::1`
- a running local Docker PostgreSQL container
- `NEMESYS_RESET_CONFIRM=RESET_NEMESYSV2_TO_PHASE22C_BASELINE`
- an explicit active, non-archived Super Admin ID
- `--apply` for mutation; dry-run is the default

The tool rejects unknown arguments, unsafe hosts, database names, missing confirmation, and invalid administrator selection. It does not use `prisma migrate reset`, `TRUNCATE CASCADE`, `DROP SCHEMA`, migration-history edits, or generic trigger/FK disabling.

## Reset Protocol

1. Snapshot source migration, canonical schema, database ACL, table-data, and selected administrator fingerprints.
2. Create a unique candidate from `template0`, restore the source schema and database grants, and copy `_prisma_migrations` unchanged.
3. Copy the selected Super Admin and active Grade 7-10 Subjects, then create only the curated Phase 22C clusters and five Grade 11 Core Subject definitions.
4. Validate all candidate counts, schema/ACL and migration identity, and administrator hash before source rename.
5. Re-snapshot the source and abort if it changed during candidate construction.
6. Rename the original source to `nemesysv2_phase22c_rollback_<timestamp>` and rename the candidate to `nemesysv2`.
7. Validate the final database and retained rollback fingerprint. A failed post-swap check restores the rollback database automatically.

The successful rollback database is retained. Rollback requires the separate `ROLLBACK_NEMESYSV2_PHASE22C_BASELINE` confirmation token, the rollback database name, and the reset output fingerprint.

## Curated Baseline

- One selected active Super Admin, preserving ID, username, email, password hash, session state, and first-login state.
- 32 active reusable Grade 7-10 Subjects, asserted at preflight.
- Five reusable Grade 11 Core Subjects: Effective Communication / Mabisang Komunikasyon, Life and Career Skills, General Mathematics, General Science, and Pag-aaral ng Kasaysayan at Lipunang Pilipino.
- Sixteen reusable Grade 11 elective Subject definitions from the approved compact starter catalog: two for each retained Academic or TechPro cluster. They contain no persisted cluster, classification, provenance, approval, or Term applicability; those facts remain future Academic Year-owned Curriculum Offering configuration.
- Eight school-facing clusters: `ACA-ASSH`, `ACA-BE`, `ACA-ICT`, `ACA-STEM`, `TP-ASET`, `TP-CBT`, `TP-CADT`, and `TP-HT`.
- No Academic Years, Terms, Offerings, Offering Terms, SHS contexts, policies, school approvals, operational records, history/evidence, or audit logs.

Subject definitions contain no permanent Term assignment. Term placement remains future Academic Year-owned Curriculum Offering configuration.

## Verification

The reset applied on 2026-09-01 asserts and produced 1 User, 53 Subjects (32 active Grade 7-10, five Grade 11 Core, and sixteen curated Grade 11 electives), 8 clusters, and zero rows in every reset operational, configuration, policy, participation, result, correction, reference, and audit table. It verified exact curated SHS Subject definitions, byte-for-byte selected Super Admin preservation, the complete 59-migration ledger, schema fingerprint, and database grants before the atomic swap. Prisma status and schema diff report no drift. The original source remains retained as `nemesysv2_phase22c_rollback_20260901062030` with rollback fingerprint `49b1bf149f1472267d89c02c573829d13034d1d76be861b4188604dd62afbc97`.
