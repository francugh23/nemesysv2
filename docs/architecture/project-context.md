# PROJECT_CONTEXT.md
# NEMESYS v2

## Document Purpose

This document is the repository's current operational state. It is not implementation history. Load the relevant milestone document under [`milestones/`](./milestones/) for completed feature decisions, validation, verification, and deferred work.

## Current Development Status

### Current Milestone

Phase 21C SSHS Curriculum Term Applicability, the focused Curriculum UI bug fixes, Phase 21D-A SHS Enrollment Foundation, Phase 21D-B Progressive SHS Current-Term Enrollment, Phase 21D-C Immutable SHS Term Result Foundation, Phase 21D-D SHS Term Result Interpretation Policy Foundation, and Phase 21E-A/B Academic Configuration Navigation and Curriculum Operational UX are complete; authenticated browser verification remains pending before production.

### Current Objective

Academic Year is the canonical period identity for academic configuration and operations, with source-backed per-Offering SSHS Term applicability, separate source and school-facing Academic taxonomy, explicit Curriculum adoption mapping, and preserved operational history.

### Completed Modules

- Student CRUD, UI, import, URL-driven server-table UX, complete filtered CSV/XLSX export, and XLSX import template
- Teacher CRUD and URL-driven server-table UX
- Subject CRUD, identity correction, archive, import, URL-driven server-table UX, and XLSX import template
- Shared CRUD toolbar and backward-compatible client/server DataTable infrastructure
- Subject Assignment foundation, creation, view, edit, and archive
- Section Management foundation, creation, view, edit, archive, and URL-driven server-table UX
- Enrollment Management foundation, lifecycle completion, controlled correction, and URL-driven server-table UX
- Academic Year canonical identity, guarded legacy migration, lifecycle management, URL-driven server-table UX, and Enrollment/Subject Assignment integration
- Academic Terms under Academic Years, including the approved 2026-2027 three-term calendar and Semester retirement from new Subject and Enrollment writes
- Subject Offering foundation with explicit Academic Term applicability and no automatic curriculum backfill
- Regular JHS Grade 7-10 baseline Subject and full-year Offering matrix for Academic Year 2026-2027
- Student Subject Enrollment persistence foundation with immutable Offering snapshots and exact Term applicability
- Regular JHS Grade 7-10 Student Subject Enrollment derivation from the approved baseline Offering matrix
- Student Subject Enrollment reconciliation history for active Enrollment Section corrections
- Enrollment-scoped read-only Student Subject Enrollment UI with accessible replacement history
- SSHS Subject Offering metadata foundation with classified, provenance-aware Offering contexts and soft-archivable elective clusters
- Provisional source-backed DepEd SSHS reference catalog for Grade 11 Core and elective candidates plus Grade 12 TechPro pilot candidates, without school approval or student curriculum materialization
- Controlled provisional-to-school-approved SSHS Offering promotion with approval actor/reference/audit, plus explicit Grade 11/12 Enrollment curriculum selection and immutable replacement history
- Official-source-corrected SSHS Term applicability with Grade 11 Core and TechPro three-Term Offerings, exact one-Term Academic Offerings, unresolved Grade 12 one-Term references, idempotent catalog reconciliation, and preserved school-approved/student history
- Controlled Enrollment terminal transitions with confirmation, transactional Student synchronization and audit, parent-authoritative subject operation, corrected shared pagination, targeted list filtering, and Audit Log export
- Academic configuration hierarchy with reusable Subjects, Academic Year-owned Terms, year-specific Curriculum terminology over Subject Offerings, and Enrollment-scoped student snapshots
- Route-linked Academic Configuration navigation, reusable-definition Subject usage indicators, JHS full-year Curriculum presentation, explicit SHS Term/context UX, and Academic Year-filtered Curriculum navigation
- Focused Curriculum form Term selection correction and URL-driven server pagination for the provisional DepEd reference catalog
- Enrollment-owned actual entry Academic Term and explicit Academic or TechPro SHS Track, with legacy-safe null preservation and no Term Enrollment model
- Progressive SHS backend foundation with Term-scoped elective identity, subject-level DROPPED lifecycle integrity, immutable participation Terms, configurable per-Term elective policies, and Philippine current-Term resolution
- Progressive SHS current-Term Enrollment with additive server-resolved selection, entry-safe Core materialization, combined elective-policy enforcement, whole-row subject DROP, complete history UI, and policy administration
- Immutable SHS Term Result evidence owned by exact Student Subject Enrollment Term membership, with draft/finalized lifecycle, historical date eligibility, Super Admin authority, and database-protected finalization
- Academic Year-owned SHS Term Result interpretation policy with fixed direct-decimal passing semantics, immutable publication, retrospective derived outcomes, and no result mutation
- Explicit Super Admin-only Curriculum adoption from ACTIVE, LOCKED, or ARCHIVED source years into DRAFT destination years, with deliberate Term mapping, atomic conflict handling, provisional SSHS carry-forward, and audit-backed provenance
- User Management authorized read path, URL-driven server-table UX, audited administrative account creation and administration, forced first-login completion, self-service password change, and credential-driven session invalidation
- Audit Log Management read-only URL-driven server-table UX, authorized details, multi-action filtering, safe supported-module navigation, immutable historical actor visibility, and export-ready validated query reuse
- Security Hardening Phase S1 centralized authorization architecture
- Security Hardening Phase S2 active-account revalidation
- Security Hardening Phase S3 immediate production security

### Milestone Records

- [Phase 08: Subject Assignment](./milestones/phase-08-subject-assignment.md)
- [Phase 09: Section Management](./milestones/phase-09-section-management.md)
- [Phase 10: Enrollment Management](./milestones/phase-10-enrollment.md)
- [Phase 11: Student Module Modernization](./milestones/phase-11-student-modernization.md)
- [Phase 12: Teacher Module Modernization](./milestones/phase-12-teacher-modernization.md)
- [Phase 13: Subject Module Modernization](./milestones/phase-13-subject-modernization.md)
- [Phase 14: Section Module Modernization](./milestones/phase-14-section-modernization.md)
- [Phase 15A: User Management Modernization](./milestones/phase-15a-user-management-modernization.md)
- [Phase 15B: User Creation](./milestones/phase-15b-user-creation.md)
- [Phase 15C: User Account Editing](./milestones/phase-15c-user-account-editing.md)
- [Phase 15D: User Account Administration](./milestones/phase-15d-user-account-administration.md)
- [Phase 15E: User Account Lifecycle Completion](./milestones/phase-15e-user-account-lifecycle.md)
- [Phase 16A: Audit Log Modernization](./milestones/phase-16a-audit-log-modernization.md)
- [Phase 16B: Audit Log Details And Export Preparation](./milestones/phase-16b-audit-log-details.md)
- [Phase 16C: Audit Log Advanced Filtering And Navigation](./milestones/phase-16c-audit-log-navigation.md)
- [Phase 17A: Shared Export Infrastructure](./milestones/phase-17a-export-architecture.md)
- [Phase 17B: Shared Import Template Infrastructure](./milestones/phase-17b-import-template-infrastructure.md)
- [Phase 18A: Query Cache Coherence](./milestones/phase-18a-query-cache-coherence.md)
- [Phase 18B: Academic Year Management](./milestones/phase-18b-academic-year-management.md)
- [Phase 18C-1: Academic Terms And Semester Write Retirement](./milestones/phase-18c-1-academic-terms.md)
- [Phase 18C-2: Subject Offering Foundation](./milestones/phase-18c-2-subject-offerings.md)
- [Phase 18C-3: Regular JHS Baseline Population](./milestones/phase-18c-3-jhs-baseline.md)
- [Phase 19A: Student Subject Enrollment Foundation](./milestones/phase-19a-student-subject-enrollment-foundation.md)
- [Phase 19B: JHS Student Subject Enrollment Derivation](./milestones/phase-19b-jhs-student-subject-enrollment-derivation.md)
- [Phase 19C: Student Subject Enrollment Reconciliation Lifecycle](./milestones/phase-19c-student-subject-enrollment-reconciliation.md)
- [Phase 19D: Student Subject Enrollment UI](./milestones/phase-19d-student-subject-enrollment-ui.md)
- [Phase 20A: SSHS Metadata Foundation](./milestones/phase-20a-shs-metadata-foundation.md)
- [Phase 20B: Provisional DepEd Reference Catalog](./milestones/phase-20b-provisional-deped-reference-catalog.md)
- [Phase 20C: SSHS Student Curriculum Selection](./milestones/phase-20c-shs-student-curriculum-selection.md)
- [Phase 21: Enrollment Lifecycle Management And Shared UI Stabilization](./milestones/phase-21-enrollment-lifecycle-ui-stabilization.md)
- [Phase 21A: Academic Curriculum Configuration Hierarchy](./milestones/phase-21a-academic-curriculum-hierarchy.md)
- [Phase 21B: Curriculum Adoption And Rollover](./milestones/phase-21b-curriculum-adoption.md)
- [Phase 21C: SSHS Curriculum Term Applicability](./milestones/phase-21c-shs-term-applicability.md)
- [Phase 21D-A: Focused Curriculum UI Bug Fixes](./milestones/phase-21d-a-curriculum-ui-bug-fixes.md)
- [Phase 21D-A: SHS Enrollment Foundation](./milestones/phase-21d-a-shs-enrollment-foundation.md)
- [Phase 21D-B1: Progressive SHS Foundation](./milestones/phase-21d-b1-progressive-shs-foundation.md)
- [Phase 21D-B2: Progressive SHS Current-Term Enrollment](./milestones/phase-21d-b2-progressive-shs-enrollment.md)
- [Phase 21D-C: Immutable SHS Term Result Foundation](./milestones/phase-21d-c-immutable-shs-term-results.md)
- [Phase 21D-D: SHS Term Result Interpretation Policy Foundation](./milestones/phase-21d-d-shs-term-result-interpretation-policy.md)
- [Phase 21E-A/B: Academic Configuration Navigation And Curriculum UX](./milestones/phase-21e-a-b-academic-configuration-ux.md)
- [Security Hardening Phase S1: Authorization Architecture](./milestones/phase-s1-authorization.md)
- [Security Hardening Phase S2: Session Revalidation](./milestones/phase-s2-session-revalidation.md)
- [Security Hardening Phase S3: Immediate Production Security](./milestones/phase-s3-security.md)

## Current Architecture

- Application flow: `Component -> Server Action -> Service -> Repository -> Prisma -> PostgreSQL`.
- Components are presentation-only and use hooks for server state.
- Server Actions validate input, enforce action-level authorization, call services, and return structured responses.
- Services own business rules, authorization orchestration, transactions, and audit coordination.
- Repositories perform Prisma data access only; related writes and audit records commit or roll back together in service-owned transactions.
- Hooks own TanStack Query integration and narrowly invalidate affected query keys.
- Protected Server Actions and Services independently enforce centralized module permissions; repositories remain authorization-free.
- Central authorization performs one request-scoped active-user lookup and evaluates permissions using the current database role, first-login state, and session version.
- Production responses apply standard browser security headers; authenticated route families and APIs are private and non-cacheable.
- Auth.js retains encrypted JWT sessions with an 8-hour rolling inactivity window and default secure cookie behavior.
- Production startup validates required secrets, database configuration, and any configured canonical Auth.js URL.
- Enrollment is the operational lifecycle source of truth. Student status and current Section are synchronized summaries maintained transactionally by `EnrollmentService`.
- Student current placement is normalized through nullable `currentSectionId`; grade, track/strand, shift, adviser, and other placement details are derived from Section.
- Enrollment is the reference implementation for URL-driven server tables. Shared components provide generic state and controls while feature modules retain query schemas, filters, sort mapping, repositories, services, and authorization.
- Student Management applies the same server-table architecture with Student-owned URL parameters, active-record search and filters, represented-value filter options, deterministic sorting, and server pagination.
- Teacher, Subject, and Section Management apply the same architecture with feature-owned query contracts, represented-value filters, deterministic server ordering, and prefix-based query invalidation.
- User Management applies the shared listing architecture to non-archived account metadata and supports audited creation and editing of Super Admin, Registrar, and Principal accounts. Teacher account creation and editing remain exclusively owned by Teacher Management.
- User creation generates eight-character temporary passwords through the shared cryptographic credential utility, hashes them with the existing bcrypt configuration, persists active first-login accounts with the audit record in one transaction, and reveals the temporary credential only in the immediate success dialog.
- User editing limits updates to approved identity and demographic fields, preserves uniqueness across archived rows, and commits changed-field audit metadata atomically with the account update.
- User administration uses dedicated transactional operations for password reset, role change, and activation/deactivation; Teacher-owned accounts remain excluded, actors cannot change their own role/status, and active Super Admin continuity is protected before role/status reductions.
- First-login accounts are redirected to a dedicated authenticated completion route and cannot pass role- or permission-protected authorization until their temporary password is replaced.
- Self-service password changes verify the current credential, apply the shared permanent-password policy, update the credential and audit atomically, and sign the user out for reauthentication.
- Password reset and self-service password changes increment a database-backed session version so older encrypted JWT sessions are rejected and cleared through the hardened invalid-session flow.
- Successful authentication enters the role-neutral account dispatcher before role routing, and the encrypted first-login claim supplies an edge routing hint so every freshly authenticated pending account reaches `/account/complete-password`; PostgreSQL revalidation remains authoritative.
- Permanent passwords require 6 to 64 Unicode code points, remain limited to 72 UTF-8 bytes for bcrypt safety, preserve whitespace, and impose no composition rules.
- `lastLoginAt` remains the latest successful credential authentication. Detailed login-event history remains deferred pending retention, monitoring, privacy, and access decisions.
- Audit Log Management applies the shared server-table architecture to immutable audit history. Reads preserve actor relationships even after User soft deletion, filter inclusive Philippine calendar dates, and never expose audit metadata or secret-bearing fields in list projections.
- Audit Log details use a separate authorized read path to load immutable metadata only when requested. Metadata is displayed structurally, changed fields are distinct when available, and the shared validated list-query parser is available to a future export action while Export remains disabled.
- Audit Log action filters support canonical comma-separated URL values and Prisma `in` filtering through the represented Action selector; supported record modules navigate through a fixed route whitelist, while unsupported historical modules remain plain text.
- Shared export infrastructure generates authorized UTF-8 CSV and XLSX artifacts from validated feature table queries. Feature Services own orchestration, feature repositories return explicit projections in deterministic batches, and the shared engine enforces row and file-size limits.
- Student export reuses the complete filtered table query while ignoring query pagination and exposes only the seven visible data columns. Other operational modules retain disabled Export placeholders until separately approved integrations.
- Shared import-template infrastructure generates definition-owned header-only XLSX workbooks without persistence access. Student and Subject definitions are the single source of truth for canonical headers, aliases, and required fields; their existing normalizers and validators consume those definitions without changing import behavior.
- Teacher, Subject, Student, and Section feature hooks own successful mutation invalidation for their active list queries and only the selector queries supplied by those source records. Import wrappers declare the same narrow dependent query keys after successful imports.
- Academic Years use canonical date-derived labels and a DRAFT, ACTIVE, LOCKED, ARCHIVED lifecycle. PostgreSQL guarantees non-overlapping dates and at most one ACTIVE year; locked years preserve dependent history while shared row locking makes Enrollment and Subject Assignment mutations read-only.
- Academic Terms are configurable date-only rows within an Academic Year. Term name and ordinal are unique per year, term dates are inclusive, non-overlapping, and contained by PostgreSQL protections, and Term mutation is allowed only while the parent year is DRAFT. Academic Year activation currently requires exactly three chronologically ordered Terms as service policy, not as a database invariant.
- Enrollment and Subject Assignment reference Academic Year by required foreign key. Historical reads retain canonical labels, while operational creation selectors include only the ACTIVE year.
- The approved 2026-2027 Academic Year contains Term 1 (2026-06-08 through 2026-09-15), Term 2 (2026-09-16 through 2026-12-18), and Term 3 (2027-01-04 through 2027-04-08). These are Academic Year configuration, not global calendar rules.
- Legacy nullable `FIRST | SECOND` Semester values remain physically preserved on Subject and Enrollment records but are excluded from new writes, imports, operational list queries, filters, sorting, and UI. They are not Term data.
- Subject Offerings are year-specific, soft-archivable records with Subject identity snapshots and explicit Academic Term rows. Offering writes require an ACTIVE Academic Year; JHS Grade 7-10 Offerings require every configured Term. No Offering rows are inferred or backfilled from existing Subjects, Sections, `trackStrand`, or Assignments.
- The approved 2026-2027 regular JHS baseline contains grade-specific Subjects and full-year Offerings for Filipino, English, Mathematics, Science, Araling Panlipunan, MAPEH, TLE, and GMRC / Values Education in Grades 7 through 10. `FIL`, `ENG`, `MATH`, `SCI`, `AP`, `MAPEH`, `TLE`, and `GMRC` plus grade are internal NEMESYS/SOLARIS identifiers, not asserted DepEd or NVGCHS official codes.
- Student Subject Enrollment is an additive, audit-ready foundation linking an Enrollment to a source Subject Offering while snapshotting the Offering identity and exact applicable Terms. Regular Grade 7-10 Enrollments in Sections without `trackStrand` materialize active records only from the approved Phase 18C-3 baseline Offering code matrix; creation, Terms, and audit records are transactional. Active Enrollment Section corrections compare approved regular-JHS eligibility and grade: same-context corrections retain rows, while changed contexts replace ACTIVE rows historically and derive only approved regular-JHS replacements. Enrollment Details provides the authorized Enrollment-scoped view, with ACTIVE rows primary and REPLACED history accessible. Grade 11/12 school-approved Curriculum selection is explicit and remains governed by the Phase 20C rules.
- Grade 11-12 Subject Offerings created through the application require an SSHS context: Core, Academic Elective, or TechPro Elective classification; provisional DepEd or school-approved provenance; and matching active Academic or TechPro clusters for electives. Cluster configuration is soft-archivable and empty by default. Existing `trackStrand` is not a source for SSHS metadata. SHS Student Subject Enrollment snapshot columns are immutable, and provisional SSHS Offerings are database-blocked from materialization. No SHS Subjects, clusters, Offerings, or Student Subject Enrollments were populated in Phase 20A.
- Phase 20B/21C maintains a controlled `PROVISIONAL_DEPED` source-backed SSHS reference catalog from DepEd DO 017, s. 2026, DM 012, s. 2026, DM 036, s. 2026, and the DepEd Strengthened SHS Program curriculum-guide catalog. Grade 11 Core and TechPro BOW candidates have Offerings for all three configured 2026-2027 Terms. Fifteen Grade 11 Academic references have exact source-backed Term positions; twelve also have a supported school-facing category and therefore have one-Term provisional Offerings, while three Sports references remain unresolved for Offering creation. The other 62 Academic references have no inferred Term. Grade 12 TechPro pilot references establish one-Term duration but no universal Term 1/2/3 assignment, so they remain `ONE_CONFIGURED_TERM_UNRESOLVED` without automatic active Offerings. The five DepEd Academic source clusters remain provenance taxonomy, while exactly four Academic categories are school-facing; Academic and TechPro ICT remain distinct records. Population reconciles only exact legacy provisional signatures, preserves deliberate school configuration and operational history, and never asserts NVGCHS availability, school approval, or Grade 12 pilot participation.
- Phase 20C school approval remains active configuration behavior, but its desired-state Student curriculum mutation is retired. Historical null-identity, multi-Term, and replacement snapshots remain readable and unchanged. New SHS student participation uses the Phase 21D-B2 current-Term progression boundary only.
- Enrollment placement correction and terminal lifecycle changes are separate commands. Only an active Enrollment in the active Academic Year may become COMPLETED, DROPPED, or TRANSFERRED; Withdraw / Unenroll persists DROPPED. Student synchronization and audit commit atomically, while Student Subject Enrollment snapshots and replacement history remain unchanged and operational use requires an active parent Enrollment.
- Enrollment remains one record per Student and Academic Year and now owns nullable legacy-safe `entryAcademicTermId` and `shsTrack` facts for SHS. New Grade 7-10 Enrollments store both fields as null and continue deriving all configured Terms through the existing JHS Student Subject Enrollment flow. New Grade 11/12 Enrollments require an explicit same-year entry Term and Academic or TechPro Track. These facts are never inferred from Section `trackStrand`, Semester, timestamps, Subjects, clusters, or catalog data, become write-once when populated, and do not create a Term Enrollment lifecycle.
- Student Subject Enrollment now has prospective `ACTIVE`, `REPLACED`, and `DROPPED` lifecycle integrity, immutable Term identities, and nullable legacy-safe selection Academic Term identity. Progressive active electives can recur for the same Offering in distinct Terms but cannot overlap the same Enrollment, Offering, and Term; Core remains a single potentially multi-Term row. Existing Phase 20C rows retain null selection identity until that workflow is replaced in Phase 21D-B2.
- SHS elective policies configure one-to-three combined Academic/TechPro electives per Academic Year, Term, and Grade 11/12. No policies are inferred or populated. The backend list/create/update boundary uses existing SHS Curriculum approval authorization and transactional audit records; student-selection enforcement remains deferred to Phase 21D-B2.
- Current Academic Term resolution uses the single active Academic Year, inclusive configured Term dates, and the Philippine calendar date in `Asia/Manila`; inter-Term gaps return no current Term and ambiguous configuration fails. Position, Semester, timestamps, Track/Strand, and client input are not current-Term authority.
- Grade 11/12 current-Term progression requires active annual Enrollment facts, initial entry in the resolved current Term, and an exact per-Term/grade policy. Core is materialized from actual local entry/current participation forward, electives are additive one-Term rows, Academic and TechPro counts are combined, SHS Track does not filter eligibility, omission preserves history, and same-Term re-selection after DROP is prohibited.
- Subject DROP is an explicit whole-row `ACTIVE -> DROPPED` command for current-Term SHS participation. It preserves every snapshot and Term, never changes Enrollment/Student or creates a replacement, and reports but permits a below-minimum elective result.
- SHS Term Results are additive evidence records owned directly by immutable Student Subject Enrollment Term composite identity. DRAFT may hold a nullable `DECIMAL(5,2)` value from 0.00 through 100.00; FINALIZED requires a value and finalization facts and is database-immutable. Only ACTIVE Grade 11/12 SHS participation may receive a result. Draft entry begins on the target Term start date, finalization begins on its end date, historical years remain eligible, and current-Term resolution is not result-entry authority.
- Existing `Permissions.GRADES` remains Super Admin-only and protects SHS Term Result mutations at Action and Service boundaries. Enrollment Details displays exact-Term evidence and permits only DRAFT editing/finalization; terminal participation remains readable without controls. Results do not infer passing, completion, credits, prerequisites, progression, promotion, or graduation.
- Each Academic Year may explicitly adopt one SHS Term Result interpretation policy while ACTIVE. The policy records the required school-approved reference and fixed `75.00` threshold, progresses from editable DRAFT to database-immutable PUBLISHED, and is protected by Super Admin-only `Permissions.GRADES` authority at Action and Service boundaries.
- A PUBLISHED policy derives PASSED when a FINALIZED result is at least `75.00` and FAILED otherwise by direct `DECIMAL(5,2)` comparison without rounding or transmutation. Publication retrospectively affects reads without mutating evidence, missing policy never blocks finalization, and Term interpretation does not infer subject completion, credits, prerequisites, progression, promotion, or graduation.
- Academic Year Details manages Grade 11/12 elective policies for configured Terms. Locked and archived years are read-only, and policies are never seeded, copied, or inferred.
- Shared pagination resets to page one when page size changes, supports 50 rendered rows, immediately reflects URL-requested Next/Previous state during placeholder transitions, and uses the server-resolved page that produced fresh records for page labels, ranges, and boundary controls. Independent tables on one route may opt into distinct URL page keys. Enrollment includes represented Track / Strand filtering, Subject Offering includes server-side code/description search with historical represented Academic Year filters, and the provisional DepEd reference catalog uses URL-driven server pagination.
- Audit Log complete filtered CSV/XLSX export uses the shared bounded repeatable-read export architecture and excludes metadata. Student and Subject remain the only import workflows; Subject import invalidates dependent Offering options.
- Academic configuration remains separated across Academic Year with nested Terms, Subjects, Subject Offerings, and Enrollment-scoped Student Subject Enrollment. Academic Years, Subjects, and Curriculum now use a route-linked Academic Configuration surface without model merging or a monolithic stepper; Enrollment remains operational and legacy Assignments remain outside configuration.
- Curriculum is the user-facing module terminology for the existing `/dashboard/subject-offerings` route and `SubjectOffering` architecture. Subjects remain reusable grade-specific definitions; Curriculum connects them to an Academic Year, grade, and Terms; Enrollment owns student-specific materialization and selection. Record-level operations retain the precise Subject Offering domain name.
- Subject list reads derive JHS/SHS grouping, DepEd-reference presence, and active Curriculum usage from existing grade and relation data only. Curriculum presents JHS as full Academic Year and keeps SHS Term applicability explicit, while the shared Academic Term badge suppresses redundant configured-name labels.
- Curriculum adoption is an explicit Super Admin-only workflow from Academic Year Details. It copies selected valid active Subject Offerings from an ACTIVE, LOCKED, or ARCHIVED source into a different DRAFT destination, requires a complete explicit one-to-one mapping of configured source and destination Terms, reuses Subjects, preserves JHS and SSHS applicability, resets every copied SSHS context to provisional review, and records batch plus per-Offering provenance audits in one serializable transaction. Active destination identities are conflicts, archived source Offerings remain excluded history, and no student-specific or operational records are copied.
- Academic Year management is available to Super Admin and Registrar through `Permissions.ACADEMIC_YEARS`; Registrar receives narrow `/dashboard/academic-years` shell access without general Dashboard permission.
- Operational module headers own the primary Add or lifecycle action. Table toolbars contain search and filters on the left and only existing Import actions plus approved or disabled Export controls on the right.
- The protected shell uses the shared sidebar provider and Base UI modal drawer: desktop state persists through the existing cookie, icon collapse retains tooltips, tablet/mobile navigation is transient below 1024px, and the sticky navbar supplies title, breadcrumbs, notifications placeholder, account controls, and the responsive trigger.
- Stable architectural principles are maintained in [`.ai/context/architecture.md`](../../.ai/context/architecture.md).

## Active Constraints

- NEMESYS v2 serves one school; do not add multi-school tenancy without an explicit architectural decision.
- PostgreSQL is the system of record, and Prisma is the only application database access layer.
- Zod validates external input at system boundaries.
- Lifecycle-managed records use soft deletion. Active reads explicitly exclude archived records, and historical relations and audit records are preserved.
- Material mutations require transactional audit records with actor, operation, module, record identity, and a human-readable outcome.
- Third-party API proposals require authoritative MCP verification when available; otherwise use official documentation, installed types/source, or CLI output and record the fallback.

## Dependency Relationships

- Section Management provides active Section selection for Subject Assignment and Section placement for Student Enrolment.
- Sections and Subject Assignments are prerequisites for adviser assignment, class lists, attendance, and grades.
- Shared DataTable, CrudToolbar, import framework, and searchable selector infrastructure are reused by feature modules.

## Next Planned Milestone

No next milestone is active or approved. Prerequisites; subject completion rules; policy correction/revision; transferred credits; reusable cross-grade SHS Subject decisions; subject reinstatement; partial-Term Core withdrawal; completed subject status; result correction/revision; Teacher completion; Subject Assignment modernization; JHS result modernization; legacy Grade migration; Scheduling; Attendance; Curriculum locking; Semester column retirement; automatic unattended progression/rollover; Enrollment reopening/archive/restore; and graduation remain deferred to separately approved subphases. Existing `trackStrand` data must not be blindly migrated. Teacher and Section import workflows; Subject, Teacher, Section, User, Enrollment, and academic-configuration export integrations; Academic Setup route consolidation; MFA; recovery; detailed login history; login throttling; breached-password checks; password history; and User archive/restore remain deferred to separately approved milestones.

## Technology Stack

- Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui, Lucide Icons
- TanStack Table and TanStack React Query
- Prisma and PostgreSQL
- SheetJS (`xlsx`) and Node.js

## Project Structure

The repository is feature-first with reusable UI centralized in `components/common` and Base UI primitives in `components/ui`. Main application layers are `app`, `actions`, `hooks`, `services`, `repositories`, `schemas`, `lib`, and `types`.
