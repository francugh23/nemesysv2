# Phase 12: Teacher Module Modernization

## Scope And Outcome

Phase 12 migrated Teacher Management from an unbounded client-side table to the established URL-driven server-table architecture. Existing create, view, edit, and deactivate dialogs, authorization, transactions, audits, and mutation behavior remain intact.

## Server Table Contract

- URL parameters are `q`, `status`, `gender`, `sort`, `direction`, `page`, and `pageSize`.
- Search tokenizes employee number and first, middle, and last names. Every token must match one supported field.
- Status and gender options include only values represented by non-archived Teacher rows whose related User is not archived.
- Teacher has no Subject filter because Subject Assignments are Section- and academic-year-scoped rather than a canonical Teacher attribute.
- The action and service independently enforce `Permissions.TEACHERS`; the action validates the feature query schema.
- The repository explicitly excludes archived Teacher and User records, applies filters, counts, ordering, skip, and take.
- The service clamps out-of-range pages and returns `items`, `totalCount`, resolved `page`, `pageSize`, and `pageCount`.

## Sorting And Query State

- Existing Teacher fields remain sortable, and Created Date is sortable without becoming a filter.
- Default ordering uses last name, first name, middle name, employee number, and Teacher ID.
- Every explicit sort ends with Teacher ID ascending for stable pagination.
- List keys are `['teachers', query]`; filter options use `['teachers', 'filter-options']`.
- `keepPreviousData` preserves rows during transitions, and successful existing mutations invalidate the `['teachers']` prefix.

## UI Decisions

- The toolbar presents Search, Status, Gender, and Reset on the left.
- Add Teacher appears in the page header. The disabled Export placeholder appears on the toolbar right. Teacher Import was not introduced.
- Initial loading uses the Teacher table skeleton. Errors and filter-option failures are retryable, background updates preserve rows, and empty copy distinguishes no records from no matches.
- Export performs no current-page or partial operation.

## Third-Party Verification

- The shadcn MCP was unavailable. Official shadcn Base UI Popover, Command, and Data Table documentation was used as the fallback, and existing generated primitives were reused.
- Official TanStack Query documentation confirmed parameterized keys and `keepPreviousData` transitions.

## Verification

- Targeted ESLint, TypeScript validation, `npx prisma validate`, `git diff --check`, and `npm run build` passed.
- A direct database read confirmed active Teacher counts and represented filter-option retrieval.
- Browser verification was not run.

## Deferred Work

- Complete filtered Teacher export requires a separately approved authorized export workflow.
- Search indexes should be considered only after measured query-volume evidence.
