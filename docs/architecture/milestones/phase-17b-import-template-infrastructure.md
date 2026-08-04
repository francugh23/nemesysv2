# Phase 17B: Shared Import Template Infrastructure

## Scope And Outcome

Phase 17B introduces reusable XLSX import-template generation and integrates template downloads for Student and Subject imports. Templates contain a header-only import worksheet followed by an Instructions worksheet. Teacher and Section templates remain deferred.

Student and Subject upload, normalization, validation, persistence, authorization, auditing, and dialog flows retain their existing behavior.

## Architecture

Import templates follow this flow:

`Component -> Server Action -> Feature Service -> Shared Template Service -> Feature Definition`

- Feature definitions own canonical headers, aliases, required fields, labels, accepted values, formats, and notes.
- The shared template service has no feature-specific logic or persistence access. It builds XLSX workbooks from definitions only.
- The import worksheet is always first. When enabled, Instructions is always second. Additional definition worksheets follow Instructions.
- Student and Subject Actions and Services independently enforce their existing module permission before template generation.
- The common Import Wizard uses the existing base64-to-Blob download helper for template delivery.
- Definitions are the single source of truth for the canonical headers, aliases, and required fields consumed by Student and Subject normalizers and validators.

## File Conventions

- Templates are XLSX files written with the installed SheetJS dependency and compression.
- Template filenames use `nemesys-{module}-import-template.xlsx`.
- The Instructions worksheet contains Field, Required, Accepted Values, Format, and Notes columns.
- Definition text is neutralized when written to cells to prevent spreadsheet formula execution.

## Security And Data Boundaries

- Template Actions authorize at the boundary and return structured success or safe failure results.
- Feature Services independently authorize before calling the shared generator.
- Templates have no database reads, repository access, Prisma access, writes, or audit records.
- The client cannot choose template columns or alter feature definitions.

## Deferred Work

- Teacher and Section template definitions and UI integrations.
- Any changes to import upload formats, parsing, normalization, validation, persistence, permissions, or audit behavior.

## Verification

- Focused tests cover Student canonical headers, workbook order, Instructions content, additional worksheet order, existing header aliases, and formula neutralization.
- Targeted ESLint, `git diff --check`, and production build are required.
- Browser download and opening both workbooks in a spreadsheet application require manual verification.
