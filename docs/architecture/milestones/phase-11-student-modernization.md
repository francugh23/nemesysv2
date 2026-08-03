# Phase 11: Student Module Modernization

## Scope And Outcome

Phase 11A migrated Student Management from an unbounded client-side table to the reusable URL-driven server-table architecture established by Enrollment Phase 10E. The Student read path now supports server search, represented-value filters, deterministic sorting, pagination, query transitions, and explicit loading, error, and empty states.

The Add Student, Edit Student, View Student, delete, and import dialogs retain their existing behavior and data contracts. Enrollment was not modified.

## Read Model Decisions

- Student reads require `Permissions.STUDENTS` at both Server Action and service boundaries.
- List queries explicitly include only Students with `deletedAt: null`.
- Current grade and Section are derived from the nullable `Student.currentSection` relation.
- The list response contains `items`, `totalCount`, resolved `page`, `pageSize`, and `pageCount`.
- List rows retain the complete Student profile and current Section/adviser relation required by the existing dialogs.

## Server Table Architecture

- URL parameters are `q`, `status`, `gender`, `grade`, `sectionId`, `sort`, `direction`, `page`, and `pageSize`.
- Search is tokenized and case-insensitively matches LRN, first name, middle name, or last name. Every search token must match at least one supported field.
- Status, gender, current grade, and current Section filters combine with logical AND.
- The Server Action validates the feature-owned query schema before delegating to the service.
- The service maps the public sort allowlist to Prisma ordering and clamps pages beyond the filtered result.
- The repository owns active-only filtering, count, projection, ordering, skip, and take.
- TanStack Query keys list variants as `['students', query]`, preserves prior rows during transitions, and disables pagination while placeholder data is displayed.
- Out-of-range resolved pages are reconciled back into the URL after current query data arrives.

## Sorting Decisions

- Supported sort fields are LRN, Name, Gender, Status, Grade Level, Current Section, and Created Date.
- Name sorting uses last name, first name, middle name, and LRN before the stable Student ID tie-breaker.
- Every ordinary sort ends with Student ID ascending so records do not drift between pages.
- Grade Level is stored as a related string. Numeric grade sorting uses a parameterized PostgreSQL query to page Student IDs, places missing or non-numeric grades last, hydrates the full rows through Prisma, and restores the SQL result order.
- The default order is last name, first name, middle name, LRN, and Student ID ascending.

## Filter Options

- The filter-options read returns only status, gender, grade, and Section values represented by non-archived Students.
- Related Sections are not independently filtered by Section lifecycle because the options describe the current Student read model.
- Grades use numeric ordering. Sections use grade, track/strand, and Section name ordering.
- The options query uses `['students', 'filter-options']`. Existing Student and Enrollment mutation invalidation of `['students']` refreshes both parameterized pages and represented options.

## UI Decisions

- The shared `DataTableToolbar` presents Search, Status, Gender, Grade Level, Current Section, Reset, background-fetch state, and a right-aligned actions slot.
- Filters use the shared accessible shadcn/Base UI Popover and Command composition.
- The table presents LRN, Name, Gender, Status, Grade, Current Section, Created Date, and row actions.
- Initial loading uses the Student table skeleton. Errors are retryable, prior rows remain visible during query transitions, and empty copy distinguishes an empty module from no filtered matches.
- Add Student remains in the page header. Import Student remains in the toolbar actions slot.
- Export is intentionally a disabled UI placeholder. No current-page or partial export is performed. Complete filtered export is deferred to a future approved Export milestone.

## Third-Party Verification

- The shadcn MCP was not exposed in the implementation session. Official shadcn Base UI Popover and Command documentation was used as the authoritative fallback, and the existing generated primitives were reused unchanged.
- Official TanStack Query documentation confirmed parameterized query keys and `keepPreviousData` for paginated transitions.
- Prisma Client guidance and installed generated types were used for filtering, relation ordering, pagination, and parameterized raw-query behavior.

## Verification

- Targeted ESLint passed for all changed TypeScript and TSX files.
- TypeScript validation passed through the production build.
- `npx prisma validate` passed.
- `git diff --check` passed with LF-to-CRLF workspace warnings.
- `npm run build` passed and includes `/dashboard/students`.
- A direct database-backed repository check confirmed active counts, numeric-grade pagination, and represented filter-option reads.
- Browser verification was not run.

## Manual Verification Checklist

- Confirm copied URLs, refresh, and browser back/forward preserve Student query state.
- Confirm search matches LRN and each Student name part.
- Confirm status, gender, grade, and Current Section filters work independently and together.
- Confirm every supported sort direction is stable across pages, including numeric grade ordering and Students without a current Section.
- Confirm page size changes reset to page one and out-of-range pages reconcile correctly.
- Confirm initial loading, background updating, retry, empty-module, and no-match states on desktop and mobile.
- Confirm Add, Import, View, Edit, and delete dialogs behave unchanged and successful mutations refresh Student rows and filter options.
- Confirm Export remains disabled and performs no partial export.

## Deferred Work

- Complete filtered Student export through a dedicated authorized export service and asynchronous UI flow.
- Student mutation transaction and audit modernization remains separate from this listing-focused milestone.
- Database search indexes should be considered only after observed query-volume evidence and an approved PostgreSQL indexing strategy.

## Dependencies

- Enrollment remains the lifecycle source of truth for Student status and current Section summaries.
- Section Management supplies current grade and Section identity through `Student.currentSection`.
- Shared DataTable, URL-state, toolbar, faceted-filter, and pagination infrastructure remain backward compatible for modules that still use client mode.
