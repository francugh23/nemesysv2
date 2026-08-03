# Phase 14: Section Module Modernization

## Scope And Outcome

Phase 14 migrated Section Management to the reusable URL-driven server-table architecture while preserving create, view, edit, archive, dependency checks, authorization, transactional audits, and dependent query invalidation.

## Server Table Contract

- URL parameters are `q`, `grade`, `trackStrand`, `shift`, `adviserId`, `sort`, `direction`, `page`, and `pageSize`.
- Search tokenizes Section name, track/strand, room, and adviser name fields.
- Grade, track/strand, shift, and adviser filters combine with logical AND and use represented non-null values from active Sections.
- Grade URL values use the same Grades 7-12 domain enum as Section create and update operations.
- The action and service independently enforce `Permissions.SECTIONS`; the action validates the feature query schema.
- Active reads explicitly require `deletedAt: null`, and the service returns resolved pagination metadata.

## Sorting And Query State

- Grade, track/strand, Section name, adviser, room, and shift are sortable with stable Section ID tie-breaking.
- Adviser ordering uses last name, first name, and middle name.
- Default and explicit numeric grade ordering use a parameterized ordered-ID page, Prisma hydration, and restored SQL ordering because grade is stored as text.
- Raw ordering and Prisma count paths apply identical search and filters.
- List keys are `['sections', query]`; filter options use `['sections', 'filter-options']`.
- Existing Section mutations continue invalidating the Section prefix and dependent form-option query families.

## UI Decisions

- The toolbar presents Search, Grade, Track / Strand, Shift, Adviser, and Reset on the left.
- Add Section appears in the page header. The disabled Export placeholder appears on the toolbar right. Section Import was not introduced.
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

- Complete filtered Section export requires a separately approved authorized export workflow.
- Nullable track/strand, shift, or adviser filtering requires an explicit collision-safe domain contract.
