# Phase 21: Enrollment Lifecycle Management And Shared UI Stabilization

## Scope And Outcome

Phase 21 separates terminal Enrollment lifecycle changes from placement correction, adds a controlled confirmation workflow, and stabilizes shared table, filtering, export, navigation, and academic-configuration UX. No Prisma schema or migration change was required.

## Enrollment Lifecycle

- Enrollment remains the operational lifecycle authority. The existing terminal statuses remain canonical: `COMPLETED`, `DROPPED`, and `TRANSFERRED`.
- Withdraw / Unenroll is a user-facing action that persists the existing `DROPPED` status. No `WITHDRAWN` or other duplicate state was introduced.
- Placement correction accepts only a destination Section. Terminal transitions use a separate validated command and confirmation dialog.
- Only a non-archived `ACTIVE` Enrollment in an `ACTIVE` Academic Year may transition. Completed, dropped, transferred, stale, locked-year, and archived-year records cannot transition or reopen.
- Server Actions and Services independently require `Permissions.ENROLLMENT`.
- The service locks the Student, share-locks the Academic Year, conditionally updates the active Enrollment, synchronizes the Student summary, and creates the audit record in one transaction.
- Student synchronization retains another valid active Enrollment when one exists. Current database invariants allow only one Enrollment per Student and Academic Year and at most one active Academic Year, so two simultaneously valid active Enrollments cannot ordinarily be created. Duplicate identity and stale historical-state behavior remain protected.
- With no valid active Enrollment, current Section is cleared. Existing summary rules remain unchanged: `DROPPED` maps to Student `DROPPED`, `TRANSFERRED` maps to `TRANSFERRED`, and `COMPLETED` maps to `ENROLLED`.

## Student Subject Enrollment Authority

- Terminal Enrollment transitions never delete, replace, or rewrite Student Subject Enrollment or Student Subject Enrollment Term rows.
- Child `ACTIVE` continues to mean the current snapshot version for its parent Enrollment. It does not override parent lifecycle authority.
- Enrollment Details remains a historical query and shows current-version and `REPLACED` rows after the parent becomes terminal.
- Operational SSHS eligibility requires an active parent Enrollment and active Academic Year. Terminal and read-only Grade 11/12 records show historical curriculum details with selection disabled.
- Each selected SSHS Offering requires an explicit nonempty subset of its configured `SubjectOfferingTerm` rows. Single-Term and multi-Term selections persist exactly those Student Subject Enrollment Terms; no all-Term default is inferred.
- Removing an SSHS Offering or changing its selected Term set marks the previous active snapshot `REPLACED` and creates a new immutable active snapshot when still selected. An identical Offering and Term set is retained unchanged.
- Existing JHS derivation, JHS replacement history, SSHS explicit selection, snapshot immutability, and provisional Offering blocking remain unchanged.

## Shared Pagination Contract

- Page-size options remain shared and support 10, 20, and 50 rows.
- Changing page size atomically sets the selected size and resets to page one in server and client table modes.
- The URL-requested page drives the footer during a placeholder transition, and the server-resolved page and page size that produced fresh rendered rows then become authoritative. Fresh clamped responses reconcile the URL after rendering.
- Footer ranges use the number of rows actually rendered, not theoretical page capacity.
- Previous is disabled on the first page. Next is disabled on the last page. Both are disabled when all records fit on one page.
- URL-driven search, filters, sorting, and page-size changes continue resetting pagination through `useTableUrlState`.

## Search And Filter Audit

- Enrollment now supports represented non-null Track / Strand filtering from non-archived Enrollment history.
- Subject Offering now supports server-side code and description search. Its list uses represented Academic Year options, including historical years, while create/edit forms retain ACTIVE-only configuration options.
- Student, Section, Subject, User, Audit Log, and Academic Year filters remain appropriate for their current read models.
- Teacher Adviser filtering is useful but not required for this phase.
- Subject Assignment remains the largest list gap. It requires the separately deferred server-table modernization before adding Teacher, Subject, Section, grade, track/strand, and Academic Year filters.
- The Student Subject Enrollment details table header and cell ordering was corrected.

## Import And Export

- Student remains the approved complete filtered CSV/XLSX export.
- Audit Log now exports the complete validated filtered result as CSV or XLSX through the shared bounded export engine and a repeatable-read transaction. Its fixed projection is Timestamp, Actor, Username, Module, Action, Record Name, Record ID, and Description. Metadata is excluded.
- Student and Subject remain the only approved import workflows. Subject import now invalidates Subject Offering options as well as Subject and Assignment queries.
- Recommended export order after this phase is Subject, Teacher after PII projection approval, Section, then separately designed academic-configuration and Enrollment reports.
- Teacher and Section imports require dedicated identity, dependency, validation, transactional audit, and invalidation decisions.
- Academic Year/Term, Subject Offering, Enrollment, and Student Subject Enrollment imports remain deferred. Generic row imports must not bypass lifecycle, provenance, approval, derivation, snapshot, or replacement-history rules.

## Academic Configuration Hierarchy

The recommended UI hierarchy is:

`Academic Year -> Academic Terms -> Subjects -> Subject Offerings -> Student Subject Enrollment`

- Models and canonical routes remain separate.
- Academic Terms remain nested in Academic Year Details.
- A future Academic Setup navigation group or route-linked tab shell may connect canonical routes while retaining deep links, URL query state, permissions, and narrow query keys.
- A monolithic page and permanent linear stepper are not recommended because Subjects are reusable and historical configuration is reviewed non-linearly.
- Legacy Semester remains retired from new writes and is not repurposed.

## Shared Stabilization

- Registrar route access now matches existing Enrollment, SSHS approval, and Academic Year permissions without widening the permission catalog.
- Super Admin navigation exposes Academic Years.
- Generic Subject Offering create/edit no longer displays school-approval controls; approval remains a dedicated controlled operation.

## Verification And Safety

- Focused Phase 19-21 lifecycle, integrity, query, pagination, export, and cache tests passed using rollback-only fixtures.
- Phase 20B regression expectations now preserve the provisional reference catalog while accepting complete Phase 20C school-approval provenance on promoted Offerings.
- Targeted ESLint, TypeScript checking, Prisma validation/generation/migration status, `git diff --check`, and production build passed.
- The database remained at 16 applied migrations. No schema, migration, or persistent operational test data was created.
- Authenticated browser verification remains required for lifecycle confirmations, 50-row rendering, filter URL behavior, Audit downloads, Registrar route access, and responsive layouts.

## Deferred Work

- Subject Assignment server-table modernization.
- Teacher Adviser filtering and additional justified represented filters.
- Subject, Teacher, Section, User, Enrollment, and academic-configuration export designs not approved above.
- New Teacher, Section, calendar, Offering, Enrollment, or subject-enrollment import workflows.
- Academic Setup route-linked tabs or a dedicated setup landing page.
- Enrollment reopening, archive/restore, graduation, rollover, bulk lifecycle changes, grading, attendance, and scheduling.
