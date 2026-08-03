# Phase 16A: Audit Log Modernization

## Scope And Outcome

Phase 16A adds a read-only Audit Log Management module at `/dashboard/audit-logs` using the shared URL-driven server-table architecture. It replaces the prior unbounded audit read with authorized, paginated, filtered, deterministic reads without changing audit writers, audit transactions, or the Prisma schema.

## Query Contract

- URL state supports `q`, `module`, `action`, `actor`, `dateFrom`, `dateTo`, `sort`, `direction`, `page`, and `pageSize`.
- `dateFrom` and `dateTo` use ISO date-only values and represent inclusive Philippine local calendar days.
- Invalid date values are cleared independently. A reversed range clears the To date while preserving the From date and unrelated filters.
- Search terms match actor first, middle, and last names; username; employee number; module; action; record ID; record name; and description.
- Module, action, and actor filters use represented values from audit records. Actor values are User IDs, so display labels cannot collide.

## Authorization And Data Boundaries

- The Server Action and service independently require `Permissions.AUDIT_LOGS`.
- Repository projections select only display-safe audit and actor metadata. Metadata, credentials, hashes, JWT/session values, and secrets are not selected for the table.
- The actor relation is selected without an active-user or soft-delete filter, preserving historical actor display for soft-deleted Users.
- Audit entries remain immutable: the module has no mutation actions, row actions, edit, delete, archive, restore, Import, or write logic.

## Table Behavior

- TanStack Query keys are `['audit-logs', query]` and `['audit-logs', 'filter-options']`.
- The module reuses `useTableUrlState`, `DataTable`, `DataTableToolbar`, `DataTableFacetedFilter`, Popover/Command filtering, placeholder data, retry states, background fetching, server pagination, and server sorting.
- Every supported sort has a stable `id` final tie-breaker; default ordering is newest timestamp first, then ID.
- Timestamps are rendered through `formatDateTime`, which explicitly uses the `Asia/Manila` time zone rather than raw UTC values.
- Actor cells show the full name with username as secondary text. Record cells show `Record Name` and `(Record ID)` when a record name exists, otherwise the record ID only.
- Empty states distinguish a module with no audit records from a filtered query with no matching records.
- Export is a disabled toolbar placeholder; no Import action exists.

## Reusable Knowledge

- No skill promotion was necessary. Existing server-table, audit-logging, and Base UI/DataTable guidance covers this read-only implementation.

## Verification

- Targeted ESLint passed for all changed TypeScript and TSX files.
- `npx prisma validate` passed.
- `git diff --check` passed with LF-to-CRLF workspace warnings.
- `npm run build` passed and includes `/dashboard/audit-logs`.
- Focused date-schema checks confirmed valid inclusive ranges pass while reversed and invalid calendar dates are rejected.
- Browser verification was not run.
