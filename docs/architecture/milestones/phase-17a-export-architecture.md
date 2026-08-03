# Phase 17A: Shared Export Infrastructure

## Scope And Outcome

Phase 17A introduces reusable, authorized CSV and XLSX export infrastructure and applies it to Student Management. Teachers, Subjects, Sections, Users, and Audit Logs remain export-ready through the shared contracts but do not expose active exports in this phase.

Shared import-template infrastructure is explicitly deferred to Phase 17B. Existing Student and Subject import normalizers, validators, and dialogs remain unchanged.

## Architecture

Exports preserve the application flow:

`Component -> Server Action -> Service -> Repository -> Prisma -> PostgreSQL`

- The shared Export button requests CSV or XLSX through a feature Server Action.
- The feature Action authorizes before validating the existing server-table query and requested format.
- The feature Service independently authorizes and owns export orchestration.
- The shared Export Service enforces limits, retrieves stable batches through feature callbacks, validates projection widths, and generates the downloadable artifact.
- Feature repositories apply their existing filters and deterministic ordering while selecting only the fields required by the approved export projection.
- The browser receives a structured base64 artifact, creates a Blob, and starts the download.

Future modules add a feature definition, projection read, Service method, Action, and UI integration without changing the core engine.

## Student Export

Student export receives and validates the same query object used by the URL-driven table. Search, status, gender, grade, Section, sorting, active-record policy, and deterministic ID tie-breakers are preserved. Query pagination remains validated but is intentionally ignored so all matching records are exported.

The export matches the visible Student table and contains only:

- LRN
- Name
- Gender
- Status
- Grade
- Current Section
- Created Date

Profile addresses, family and guardian contacts, internal identifiers, lifecycle metadata, and row actions are not exported.

## File Conventions

- CSV is UTF-8 with a byte-order mark, CRLF lines, RFC 4180-compatible escaping, and an Excel-compatible MIME type.
- XLSX uses the installed SheetJS writer with compression and ordered columns.
- User-derived strings with spreadsheet-formula prefixes are neutralized in both formats.
- Identifiers remain strings so leading zeroes are preserved.
- Export dates use `YYYY-MM-DD` in `Asia/Manila`.
- Filenames use `nemesys-{module}-{yyyyMMdd-HHmmss}-PHT.{format}`.

## Performance And Delivery

- Phase 17A generation is synchronous and buffered because Server Actions do not stream attachments.
- Matching records are read in deterministic batches of 1,000.
- Student batches run inside a repeatable-read transaction so concurrent changes cannot shift offset boundaries or alter grade-query hydration.
- Exports are limited to 10,000 records and a generated file size of 10 MiB.
- Individual cells are limited before workbook and base64 generation to reject pathological values early.
- Count and loaded-row mismatches fail safely when records change during generation.
- A future background workflow can reuse the same feature definitions and shared generator while replacing only artifact delivery and storage.

## Security

- Student export reuses `Permissions.STUDENTS` at both Action and Service boundaries.
- The repository is authorization-free and returns an explicit export projection.
- Client requests cannot choose columns or supply Prisma ordering.
- Only safe `ExportError` messages are returned; unexpected persistence or generation errors receive a generic response.
- Export is read-only and does not modify existing audit behavior.

## Reusable Knowledge

The stable export boundaries were promoted to `.ai/context/architecture.md`. No new skill or prompt was necessary.

## Verification

- Focused tests cover CSV encoding and escaping, formula neutralization, XLSX column order, Philippine timestamps, batching, and row-limit rejection.
- Targeted ESLint passed for changed TypeScript and TSX files.
- `npx prisma validate` passed.
- `git diff --check` passed with LF-to-CRLF workspace warnings only.
- `npm run build` passed and includes `/dashboard/students`.
- Browser download verification was not run.
