# Phase 18B: Academic Year Management

## Scope And Outcome

Phase 18B replaces Enrollment and Subject Assignment free-text academic-year values with a canonical `AcademicYear` relation. Academic Years are managed at `/dashboard/academic-years` through a URL-driven server table and the lifecycle `DRAFT -> ACTIVE -> LOCKED -> ARCHIVED`.

The implementation preserves existing Enrollment, Subject Assignment, Grade, and Audit Log history. Semester governance, three-term modeling, Section offerings, scheduling, automatic rollover, reopening, import/export, bulk operations, and hard deletion remain outside this phase.

## Data Model And Migration

- `AcademicYear` stores a stable ID, derived `YYYY-YYYY` label, date-only start and end dates, lifecycle status, optional legacy creator, and timestamps.
- Enrollment and Subject Assignment store required `academicYearId` foreign keys with `ON DELETE RESTRICT`.
- Their existing compound identities now use `academicYearId` rather than free text.
- PostgreSQL check constraints enforce chronological dates, consecutive calendar years, and label/date agreement.
- A PostgreSQL exclusion constraint rejects inclusive overlapping date ranges across all lifecycle states.
- A partial unique index guarantees at most one `ACTIVE` Academic Year under concurrency.
- No delete operation exists; `ARCHIVED` is the terminal visibility state.

The guarded transactional migration accepts only the approved exact legacy value `2026-2027`. It maps that value to `2026-06-08` through `2027-04-08` with initial status `ACTIVE`. It aborts before destructive changes on unknown or ambiguous values, and aborts before foreign-key enforcement if canonical identities would collide.

The migration preserves record IDs and does not update Enrollment, Subject Assignment, Grade, or Audit Log timestamps or content. The migrated Academic Year has a null creator because no trustworthy historical actor exists.

## Lifecycle Rules

- Create always produces `DRAFT`.
- Only DRAFT years can be edited or activated.
- Activation fails while another ACTIVE year exists; it never changes another year implicitly.
- ACTIVE years can be locked.
- Locking preserves all related Enrollment and Subject Assignment rows without changing their statuses or archival state.
- Dependent Enrollment and Subject Assignment mutations acquire a shared Academic Year row lock and require status `ACTIVE`.
- The Academic Year status transition acquires the conflicting row lock, preventing a dependent mutation from committing after a concurrent lock.
- LOCKED years and their dependent academic records are read-only.
- DRAFT and LOCKED years can be archived. ARCHIVED years remain historically readable and are terminal.
- Reopening, automatic activation, and rollover are not supported.

## Authorization And Routing

- `Permissions.ACADEMIC_YEARS` grants full management to `SUPER_ADMIN` and `REGISTRAR`.
- `PRINCIPAL` and `TEACHER` are denied.
- Registrar does not receive `Permissions.DASHBOARD`.
- The proxy permits Registrar only through the `/dashboard/academic-years` route family, and the Registrar default redirect and navigation expose only that approved management route.
- Server Actions and Services independently enforce the Academic Year permission through database-revalidated authorization. Auth.js JWT sessions, first-login enforcement, and sessionVersion behavior are unchanged.
- Enrollment and Subject Assignment option reads retain their own feature permissions.

## Consumer Integration

- Enrollment and Subject Assignment creation forms use ACTIVE-only Academic Year ID selectors.
- Subject Assignment update and archive operations require the related year to remain ACTIVE.
- Enrollment update operations require the related year to remain ACTIVE.
- Locked and archived dependent rows remain visible but expose no mutation controls.
- Enrollment search matches the related canonical label, filtering uses `academicYearId`, and chronological sorting uses related Academic Year dates.
- Enrollment's specialized raw grade-sort path joins and projects `AcademicYear` explicitly.
- Historical Enrollment filter options remain represented regardless of Academic Year status.
- Existing `FIRST` and `SECOND` Semester values are preserved unchanged. They are not treated as proof that the official School Year 2026-2027 three-term calendar fits the current Semester model.

## Cache Coherence

Academic Year hooks own every management mutation. Successful create, update, activate, lock, and archive operations invalidate only:

- `['academic-years']`
- `['subject-assignment-options']`
- `['enrollment-form-options']`

Failed mutations invalidate nothing. Existing Enrollment and Subject Assignment mutation invalidation remains unchanged.

## Auditing

Academic Year `CREATE`, `UPDATE`, `ACTIVATE`, `LOCK`, and `ARCHIVE` records use the existing transactional Audit Log writer and module `AcademicYear`. Updates and lifecycle transitions include changed-field metadata. Mutation and audit writes commit or roll back together. Academic Year records are included in the Audit Log navigation whitelist.

## Verification

- The full migration chain passed against disposable PostgreSQL.
- A legacy Enrollment, Subject Assignment, and linked Grade retained their IDs and relations after migration.
- Whitespace-variant legacy data aborted before schema changes.
- A legacy Enrollment identity collision aborted before foreign-key enforcement.
- Canonical label, date chronology, non-overlap, and single-ACTIVE PostgreSQL constraints passed direct verification.
- Concurrent activation testing committed exactly one of two competing activations.
- Forced audit failure rolled back its Academic Year mutation.
- Live repository verification passed for ordinary Enrollment reads, raw grade sorting, represented historical filters, Subject Assignment reads, and ACTIVE-only selectors.
- Focused Academic Year, permission, lifecycle, and cache tests passed with the existing regression suites.
- Targeted ESLint passed.
- `npx prisma validate` and `npx prisma generate` passed.
- `npx prisma migrate status` reports the database up to date.
- Prisma migration diff reports an empty migration.
- `git diff --check` passed with LF-to-CRLF workspace warnings only.
- `npm run build` passed and includes `/dashboard/academic-years`.
- Authenticated browser verification was not run because this environment has no authenticated browser harness or test credentials. It remains a pre-production requirement for every role, lifecycle operation, historical view, selector refresh, route-isolation rule, and Auth.js/session safeguard listed in the approved scope.

## Deferred Work

- Before Phase 18C, explicitly reconcile the existing nullable `FIRST | SECOND` Semester model with the official three-term DepEd School Year 2026-2027 structure. Do not assume the current Semester enum represents those terms.
- Semester Management and Academic Year term relations.
- Reopening LOCKED Academic Years.
- Automatic activation and rollover.
- Section offerings, scheduling, and broader Subject Assignment modernization.
- Academic Year import/export and bulk lifecycle operations.
- Hard deletion and restore.
- Principal or Teacher read-only access and separate view/manage permissions.

## Reusable Knowledge

No new `.ai` skill was added. The shared-row-lock read-only protocol is currently specific to Academic Year lifecycle enforcement and should be promoted only if a later approved period domain reuses it.
