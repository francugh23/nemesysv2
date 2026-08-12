# Phase 21D-A: Focused Curriculum UI Bug Fixes

## Scope And Outcome

Phase 21D-A corrects two isolated Curriculum UI defects without changing the academic configuration hierarchy, Prisma schema, migrations, catalog data, Enrollment lifecycle, or Student Subject Enrollment behavior.

## Academic Term Selector

- The Subject Offering form already received active Academic Years with their nested Terms, and the service already validated that submitted Term IDs belong to the selected Academic Year.
- The form now uses an explicit React Hook Form subscription for the selected Academic Year before resolving its Terms. Selecting an Academic Year therefore updates the displayed owned Term options reliably.
- Changing the Academic Year continues to clear the selected Terms. No automatic SSHS Term 1-3 selection was introduced.
- JHS full-three-Term validation remains unchanged in the Subject Offering service.

## Provisional DepEd Reference Catalog Pagination

- The catalog previously loaded every reference as a client-mode table and therefore did not participate in the shared server-table contract.
- The catalog now has a validated page query, deterministic repository paging and count, response metadata, TanStack Query placeholder data, and shared `resolveServerPagination` integration.
- Catalog URL state uses `catalogPage` and `catalogPageSize`, preventing collisions with the existing Curriculum table's `page` and `pageSize` state on the same route.
- The shared pagination controls now govern catalog Next, Previous, page size, displayed range, final-page boundaries, and fresh server-page reconciliation. Existing table behavior remains unchanged because the URL-state additions are opt-in.

## Preserved Boundaries

- No Prisma schema, migration, or catalog data change
- No Curriculum hierarchy redesign
- No automatic SSHS progression, grade, scheduling, or Phase 21D work
- No Enrollment or Student Subject Enrollment mutation or behavior change
- No change to Phase 21C exact Academic Elective Term applicability, categories, operational history, or immutable snapshots

## Verification

- Focused UI/data-contract suite: 20 tests passed.
- Phase 19 through 21C regression batch: 74 passed and one pre-existing rollback test encountered a database deadlock under parallel execution; that test passed when rerun in isolation, for 75 verified passing tests.
- Targeted ESLint, TypeScript, Prisma validation, migration status, production build, and `git diff --check` passed.
- Read-only database audit found 203 Subjects, 138 Offerings, 3 Enrollments, and 20 Student Subject Enrollment snapshots with zero active Offering duplicates and zero Offering-Term Academic Year mismatches.
- Authenticated browser verification remains required before production for the full form interaction and catalog pagination interaction.
