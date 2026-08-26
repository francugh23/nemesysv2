# Phase 13: Subject Module Modernization

## Scope And Outcome

Phase 13 migrated Subject Management to the reusable URL-driven server-table architecture while preserving Subject identity rules, dialogs, archive checks, transactional audits, mutations, and the existing spreadsheet Import workflow.

## Server Table Contract

- URL parameters are `q`, `grade`, `semester`, `sort`, `direction`, `page`, and `pageSize`.
- Search tokenizes Subject code, description, and track/strand. Grade, track/strand, and semester filters combine with logical AND.
- Filter options contain represented non-null values from active Subjects. No nullable string sentinel was introduced.
- The action and service independently enforce `Permissions.SUBJECTS`; the action validates the feature query schema.
- Active reads always require `deletedAt: null`, and the response includes paginated metadata with a resolved page.

## Sorting And Query State

- Code, description, numeric Grade Level, track/strand, and semester are sortable with stable Subject ID tie-breaking.
- Because grade is stored as text, default and explicit grade ordering use a parameterized query for the ordered page of IDs, hydrate rows through Prisma, and restore ID order.
- Raw ordering applies the same search and filters as the Prisma count path.
- List keys are `['subjects', query]`; filter options use `['subjects', 'filter-options']`.
- Existing `['subjects']` invalidation refreshes every cached page, filter variant, and represented option set, including after Import.

## UI Decisions

- The toolbar presents Search, Grade, Track / Strand, Semester, and Reset on the left.
- Add Subject appears in the page header. The existing Import Subject workflow and disabled Export placeholder appear on the toolbar right.
- Loading, background updating, retryable list and filter errors, empty-module, and no-match states follow the Student reference.
- Export performs no current-page or partial operation.

## Third-Party Verification

- The shadcn MCP was unavailable. Official shadcn Base UI Popover, Command, and Data Table documentation was used as the fallback.
- Official TanStack Query documentation confirmed parameterized keys and `keepPreviousData` transitions.

## Verification

- Targeted ESLint, TypeScript validation, `npx prisma validate`, `git diff --check`, and `npm run build` passed.
- A direct database read confirmed active counts, represented options, and numeric grade ordering.
- Browser verification was not run.

## Deferred Work

- Complete filtered Subject export requires a separately approved authorized export workflow.
- Nullable track/strand or semester filtering requires an explicit collision-safe domain contract.
