# PROJECT_CONTEXT.md
# NEMESYS v2

## Document Purpose

This document is the repository's current operational state. It is not implementation history. Load the relevant milestone document under [`milestones/`](./milestones/) for completed feature decisions, validation, verification, and deferred work.

## Current Development Status

### Current Milestone

Phase 22D-A configured SY 2026-2027 from the Phase 22C clean baseline: three Terms, five organizational Sections (Grades 7-11 A), 32 full-year JHS Offerings, five full-year Grade 11 Core Offerings, and three Grade 11 elective Offerings. Phase 22D-B1 approved all eight SHS Offerings with legitimate DepEd Order No. 017, s. 2026 evidence; six policy scopes are intact. Phase 22D-B2 finalized Curriculum configuration while the Academic Year remains ACTIVE; finalization is not AY locking. The dashboard correctly reports five organizational Sections but zero enrollment-derived Active Sections until active Enrollments exist. The retained Phase 22C rollback database is `nemesysv2_phase22c_rollback_20260901062030`.

### Current Objective

Academic Year remains the canonical period identity for academic configuration and operations. Enrollment supports unchanged same-grade Section correction and a separate controlled regular JHS Grades 7-10 different-grade correction that preserves old participation history and creates a new full-year destination baseline under the same Enrollment identity.

Phase 21F-C1/C2 controlled SHS participation correction and Phase 21F-D immutable SHS Term Result revision are implemented. C1 and result-revision concurrency coverage is environment-gated because no safe disposable database URL is configured; shared development is intentionally never used for those races.

Phase 22A provides a guarded development-only clean-school walkthrough database workflow. Phase 22C separately provides guarded candidate-build and atomic-swap reset tooling for the exact local `nemesysv2` database, preserving the prior source as a rollback database rather than deleting immutable history in place. Its curated baseline contains 32 active Grade 7-10 Subjects, five reusable Grade 11 Core Subjects, sixteen reusable Grade 11 elective Subjects, and eight clusters; it creates no Academic Years, Terms, Curriculum Offerings, policies, participation, results, corrections, references, or audit history.

Phase 22D-0 removed the legacy `trackStrand` fields from Section and Subject through a guarded migration after the clean-baseline preflight confirmed no values or identity collisions. Section is organizational only; reusable Subject identity is code plus grade; SHS authority remains on Enrollment track and Subject Offering SSHS context/cluster.

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
- Composed Academic Year Details with embedded Terms, factual Curriculum and permission-aware SHS policy summaries, focused policy dialogs, and non-persisted operational readiness notices
- Focused Curriculum form Term selection correction plus retirement of the DepEd reference catalog from routine user workflows while preserving hidden historical/reference infrastructure
- Explicit immutable Curriculum finalization with automatic Offering, Term, SHS context/approval, policy-scope, Academic Term, and cluster dependency guards
- Controlled append-only Curriculum Offering correction with immutable one-to-one lineage, exact database-scoped archive-and-replace protocol, preserved student history, and prospective SHS adoption
- Derived SHS prospective Curriculum replacement with immediate-next effective Term, exact remaining predecessor Terms, classification-compatible lineage, ancestor DROP blocking, policy-safe elective validation, and partial-year adoption exclusion
- Controlled same-grade Enrollment Section correction with immutable evidence-backed history, exact database-scoped transaction capability, preserved participation/results/Curriculum history, and atomic Student placement synchronization
- Controlled regular JHS Grades 7-10 different-grade Enrollment correction with immutable parent/child evidence, exact source and destination baseline rules, preserved old Terms, replacement history, new full-year participation, and atomic Student placement synchronization
- Controlled SHS Core, Academic Elective, and TechPro Elective participation correction with exact Term preview, safe server-filtered replacements, typed post-start confirmation, and separate immutable history
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
- Phase 22C guarded local development baseline reset with retained rollback database
- Phase 22D-A authenticated development-only SY 2026-2027 bootstrap with Terms, Grade 7-11 organizational Sections, 40 provisional Curriculum Offerings, and six elective-policy readiness scopes
- Phase 23-A Offering-Term-scoped Subject Assignment identity, active-slot uniqueness, and started-Term ownership protection

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
- [Phase 21E-C: Academic Year Configuration Composition](./milestones/phase-21e-c-academic-year-configuration-composition.md)
- [Phase 21E-D: DepEd Reference Catalog Retirement From User Workflow](./milestones/phase-21e-d-deped-catalog-workflow-retirement.md)
- [Phase 21E-E1: Curriculum Finalization And Dependency Guards](./milestones/phase-21e-e1-curriculum-finalization-dependency-guards.md)
- [Phase 21E-E2-A: Controlled Curriculum Correction Foundation](./milestones/phase-21e-e2-a-controlled-curriculum-correction.md)
- [Phase 21E-E2-B: SHS Prospective Curriculum Replacement Rules](./milestones/phase-21e-e2-b-shs-prospective-curriculum-replacement.md)
- [Phase 21F-A: Controlled Enrollment Placement Correction](./milestones/phase-21f-a-controlled-enrollment-placement-correction.md)
- [Phase 21F-B: Regular JHS Grade-Level Correction](./milestones/phase-21f-b-jhs-grade-level-correction.md)
- [Phase 21F-C1: Controlled SHS Participation Correction](./milestones/phase-21f-c1-shs-participation-correction.md)
- [Phase 21F-C2: SHS Participation Correction Read And UI](./milestones/phase-21f-c2-shs-participation-correction-ui.md)
- [Phase 21F-C3: SHS Participation Correction Final Verification](./milestones/phase-21f-c3-shs-participation-correction-final-verification.md)
- [Phase 21F-D: SHS Term Result Revision](./milestones/phase-21f-d-shs-term-result-revision.md)
- [Development Clean-School Walkthrough Database](../development/clean-school-walkthrough.md)
- [Phase 22C: Development Baseline Reset](./milestones/phase-22c-development-baseline-reset.md)
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
- Student current placement is normalized through nullable `currentSectionId`; grade, shift, adviser, and other organizational placement details are derived from Section. SHS track remains Enrollment-owned.
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
- Academic Terms are configurable date-only rows within an Academic Year. Term name and ordinal are unique per year, term dates are inclusive, non-overlapping, and contained by PostgreSQL protections, and Service plus PostgreSQL guards allow Term mutation only while the parent year is DRAFT. Academic Year activation currently requires exactly three chronologically ordered Terms as service policy, not as a database invariant.
- Enrollment and Subject Assignment reference Academic Year by required foreign key. Historical reads retain canonical labels, while operational creation selectors include only the ACTIVE year.
- The approved 2026-2027 Academic Year contains Term 1 (2026-06-08 through 2026-09-15), Term 2 (2026-09-16 through 2026-12-18), and Term 3 (2027-01-04 through 2027-04-08). These are Academic Year configuration, not global calendar rules.
- Legacy nullable `FIRST | SECOND` Semester values remain physically preserved on Subject and Enrollment records but are excluded from new writes, imports, operational list queries, filters, sorting, and UI. They are not Term data.
- Subject Offerings are year-specific, soft-archivable records with Subject identity snapshots and explicit Academic Term rows. Ordinary Offering writes require an ACTIVE, unfinalized Curriculum; JHS Grade 7-10 Offerings require every configured Term. Any Student Subject Enrollment dependency freezes semantic Offering, Term, and SHS context/approval changes, while pre-finalization archive remains available to stop future use without rewriting history.
- The approved 2026-2027 regular JHS baseline contains grade-specific Subjects and full-year Offerings for Filipino, English, Mathematics, Science, Araling Panlipunan, MAPEH, TLE, and GMRC / Values Education in Grades 7 through 10. `FIL`, `ENG`, `MATH`, `SCI`, `AP`, `MAPEH`, `TLE`, and `GMRC` plus grade are internal NEMESYS/SOLARIS identifiers, not asserted DepEd or NVGCHS official codes.
- Student Subject Enrollment is an additive, audit-ready foundation linking an Enrollment to a source Subject Offering while snapshotting the Offering identity and exact applicable Terms. Regular Grade 7-10 Enrollments materialize active records only from the approved Phase 18C-3 baseline Offering code matrix; ordinary derivation is creation-only and the dormant generic reconciliation/replacement helper is retired. Controlled same-grade Enrollment Section correction remains unchanged and preserves every participation and Term identity without replacement. Controlled different-grade regular JHS correction preserves the same Enrollment ID, retains old Terms, changes exact active source baseline rows only to `REPLACED`, and creates a separate full-year destination baseline. Enrollment Details keeps ACTIVE rows primary with replacement history accessible. Grade 11/12 school-approved Curriculum selection remains governed by the Phase 21D-B2 current-Term progression rules.
- Grade 11-12 Subject Offerings created through the application require an SSHS context: Core, Academic Elective, or TechPro Elective classification; source/provenance text; and matching active school-facing Academic or TechPro clusters for electives. They remain pending school approval under the persisted `PROVISIONAL_DEPED` status until the controlled approval action establishes `SCHOOL_APPROVED`. Sections and reusable Subjects are not sources for SSHS metadata. SHS Student Subject Enrollment snapshot columns are immutable, and pending Offerings are database-blocked from materialization.
- The approved Grade 11 Core foundation contains exactly five reusable definitions: Effective Communication / Mabisang Komunikasyon, Life and Career Skills, General Mathematics, General Science, and Pag-aaral ng Kasaysayan at Lipunang Pilipino. Effective Communication / Mabisang Komunikasyon is one Subject and Offering; no separate instructional-component, grading, or result model is inferred.
- Phase 20B/21C reference data remains intact as hidden historical/reference infrastructure from DepEd DO 017, s. 2026, DM 012, s. 2026, DM 036, s. 2026, and the Strengthened SHS curriculum-guide catalog. It has no routine user-facing table, route, filters, or Subject badge and does not prescribe future school Curriculum, classifications, clusters, or Term choices. Catalog reconciliation maintains only catalog-defined identities/evidence and no longer demotes school-managed Academic categories. Existing unresolved Grade 12 TechPro references remain unchanged and never infer a Term.
- Phase 20C school approval remains active configuration behavior, but its desired-state Student curriculum mutation is retired. Historical null-identity, multi-Term, and replacement snapshots remain readable and unchanged. New SHS student participation uses the Phase 21D-B2 current-Term progression boundary only.
- Enrollment placement correction, regular JHS grade-level correction, and terminal lifecycle changes are separate commands. Phase 21F-A same-grade placement correction remains unchanged: it requires active synchronized records, expected source identity, distinct same-grade Sections, reason/evidence, confirmation, and Super Admin or Registrar authority, and preserves all participation, Terms, results, Grades, Curriculum, lifecycle, and entry facts. Phase 21F-B uses the same authority but requires distinct regular JHS Grades 7-10 Sections in different grades, an exact zero-or-eight active source baseline with no `REPLACED`/`DROPPED` history or attached result, and exactly eight active/current destination baseline Offerings covering all Terms. A corrected successor with `replacesSubjectOfferingId` is eligible when otherwise valid; an Offering with an active downstream replacement is not. Enrollment Details provides a unified permission-aware correction and history surface, with exact typed confirmation after Term start. Only an active Enrollment in the active Academic Year may separately become COMPLETED, DROPPED, or TRANSFERRED; Withdraw / Unenroll persists DROPPED.
- Enrollment remains one record per Student and Academic Year and now owns nullable legacy-safe `entryAcademicTermId` and `shsTrack` facts for SHS. New Grade 7-10 Enrollments store both fields as null and continue deriving all configured Terms through the existing JHS Student Subject Enrollment flow. New Grade 11/12 Enrollments require an explicit same-year entry Term and Academic or TechPro Track. These facts are never inferred from Section, Semester, timestamps, reusable Subjects, clusters, or catalog data, become write-once when populated, and do not create a Term Enrollment lifecycle.
- Student Subject Enrollment now has prospective `ACTIVE`, `REPLACED`, and `DROPPED` lifecycle integrity, immutable Term identities, and nullable legacy-safe selection Academic Term identity. Progressive active electives can recur for the same Offering in distinct Terms but cannot overlap the same Enrollment, Offering, and Term; Core remains a single potentially multi-Term row. Existing Phase 20C rows retain null selection identity until that workflow is replaced in Phase 21D-B2.
- SHS elective policies configure zero-to-three combined Academic/TechPro electives per Academic Year, Term, and Grade 11/12. A 0/0 scope explicitly permits no elective selection and remains configured for readiness; no policies are inferred. Existing SHS Curriculum approval authorization and transactional audits remain; create/update/delete is frozen once SHS participation exists in the exact year/grade/Term scope, while documented subject DROP may remain below the minimum.
- Current Academic Term resolution uses the single active Academic Year, inclusive configured Term dates, and the Philippine calendar date in `Asia/Manila`; inter-Term gaps return no current Term and ambiguous configuration fails. Position, Semester, timestamps, Track/Strand, and client input are not current-Term authority.
- Grade 11/12 current-Term progression requires active annual Enrollment facts, initial entry in the resolved current Term, and an exact per-Term/grade policy. Core is materialized from actual local entry/current participation forward, electives are additive one-Term rows, Academic and TechPro counts are combined, SHS Track does not filter eligibility, omission preserves history, and same-Term re-selection after DROP is prohibited.
- Subject DROP is an explicit whole-row `ACTIVE -> DROPPED` command for current-Term SHS participation. It preserves every snapshot and Term, never changes Enrollment/Student or creates a replacement, and reports but permits a below-minimum elective result.
- SHS Term Results are additive evidence records owned directly by immutable Student Subject Enrollment Term composite identity. DRAFT may hold a nullable `DECIMAL(5,2)` value from 0.00 through 100.00 and remains ordinarily editable; FINALIZED requires a value and finalization facts and is database-immutable. FINALIZED numeric corrections append immutable `ShsTermResultRevision` rows with reason/evidence, actor/time, predecessor, and contiguous sequence. The root final value remains historical evidence while the latest revision supplies authoritative read/interpretation value. Revisions never reopen, void, move, or reassign a result and never enable SHS participation correction. Only ACTIVE Grade 11/12 SHS participation may receive a result or revision.
- Existing `Permissions.GRADES` remains Super Admin-only and protects SHS Term Result mutations at Action and Service boundaries. Enrollment Details displays exact-Term evidence, permits DRAFT editing/finalization, and exposes a typed-confirmation immutable revision workflow only for FINALIZED active SHS results. Terminal participation remains readable without controls. Results do not infer passing, completion, credits, prerequisites, progression, promotion, or graduation.
- Each Academic Year may explicitly adopt one SHS Term Result interpretation policy while ACTIVE. The policy records the required school-approved reference and fixed `75.00` threshold, progresses from editable DRAFT to database-immutable PUBLISHED, and is protected by Super Admin-only `Permissions.GRADES` authority at Action and Service boundaries.
- A PUBLISHED policy derives PASSED when a FINALIZED result is at least `75.00` and FAILED otherwise by direct `DECIMAL(5,2)` comparison without rounding or transmutation. Publication retrospectively affects reads without mutating evidence, missing policy never blocks finalization, and Term interpretation does not infer subject completion, credits, prerequisites, progression, promotion, or graduation.
- Academic Year Details composes Overview, embedded Academic Terms, factual Curriculum aggregates, permission-aware SHS policy summaries, operational readiness notices, and separate Configurable/Finalized/Historical Curriculum state in one constrained modal. Super Admin finalization is a focused irreversible confirmation; finalized Curriculum freezes configuration without changing `AcademicYear.status` or stopping Enrollment, SHS progression/drop, results, or interpretation.
- Controlled Curriculum correction is an append-only same-year archive-and-replace operation for finalized or participation-dependent Offerings during an inter-Term gap. It creates immutable one-to-one Offering lineage and a reason/evidence-backed correction event while preserving predecessor Student Subject Enrollment, Term, result, Enrollment, finalization, and approval history.
- The correction Service owns serializable locking, exact successor validation, three audits, and bounded transaction retry. PostgreSQL scopes the E1 exception to the exact correction identity and validates lifecycle, immediate-next effective Term, exact remaining predecessor Terms, lineage, snapshots, archive state, SHS classification/cluster/policy compatibility, new provenance, independent approval evidence, and matching approval actor/timestamp at commit. Deferred child triggers revalidate the stored replacement snapshot if direct SQL forces correction checks early and then inserts Offering Terms or SHS context.
- SHS progression resolves compatible replacement ancestry prospectively: only Core-to-Core ancestry contributes uncovered-Term continuation, only elective-to-elective ancestry contributes elective identity mapping, repeated compatible chains resolve all ancestors, and an ancestor DROP blocks descendants for the Academic Year without moving historical rows.
- Curriculum correction is never a student-correction mechanism. Wrong student grade or Section placement, JHS participation, SHS Core or Academic/TechPro elective selection, Term-specific participation, Student Subject Enrollment or Term membership, and result mistakes remain immutable under this workflow and require separately approved student-specific commands.
- Partial-year correction successors whose predecessors covered more Terms are not adoptable. Ordinary eligible successors remain governed by existing adoption rules, and adoption copies neither lineage, finalization, approval, nor student records.
- Enrollment placement correction uses a serializable, bounded-retry Service transaction and an exact PostgreSQL transaction-local capability. Durable sequence-backed advisory membership plus in-progress event provenance, deferred snapshot validation, Section isolation, Student-summary isolation, and participation/result/Grade isolation reject forged, stale, replayed, savepoint-escaped, delete/reinsert, or composition-based bypasses while allowing multiple valid corrections in one transaction to revalidate independently.
- Regular JHS grade-level correction uses its own serializable bounded-retry transaction and separate exact GUC/advisory capability. Immutable `StudentEnrollmentGradeCorrection` parents and `StudentParticipationCorrection` children prove placement and prefix-matched source/replacement snapshots; PostgreSQL blocks generic regular-JHS replacement, enforces administrative `ACTIVE -> REPLACED` source transitions with no `DROPPED` transition, preserves old Terms, validates the new full-year baseline, and isolates Enrollment, Student, Section, Subject, Offering, participation, result, Grade, audit, and correction evidence through commit.
- SHS participation correction uses the unchanged C1 function-backed serializable command. Its separately authorized C2 read context and exact source-Term preview expose only replacement Offerings that meet C1's active, approved, classification, Term-coverage, duplicate, policy, and lineage/DROP rules; Core previews cover the selected Term forward while electives cover exactly the selected Term. After the selected authoritative Term start, application validation requires the exact typed source-participation phrase before mutation. Enrollment Details keeps immutable SHS subject correction history separate from placement/grade correction history.
- The Academic Year configuration summary is a non-persisted, service-owned repeatable-read projection. The only activation blocker remains the existing exactly-three-chronological-Term requirement; Curriculum and policy gaps are warnings or information only. Result interpretation policy facts are omitted unless the caller has `Permissions.GRADES`.
- Shared pagination resets to page one when page size changes, supports 50 rendered rows, immediately reflects URL-requested Next/Previous state during placeholder transitions, and uses the server-resolved page that produced fresh records for page labels, ranges, and boundary controls. Enrollment includes represented Track / Strand filtering, while Curriculum includes server-side code/description search with historical represented Academic Year filters.
- Audit Log complete filtered CSV/XLSX export uses the shared bounded repeatable-read export architecture and excludes metadata. Student and Subject remain the only import workflows; Subject import invalidates dependent Offering options.
- Academic configuration remains separated across Academic Year with nested Terms, Subjects, Subject Offerings, and Enrollment-scoped Student Subject Enrollment. Academic Years, Subjects, and Curriculum now use a route-linked Academic Configuration surface without model merging or a monolithic stepper; Enrollment remains operational and legacy Assignments remain outside configuration.
- Curriculum is the user-facing module terminology for the existing `/dashboard/subject-offerings` route and `SubjectOffering` architecture. Subjects remain reusable grade-specific definitions; Curriculum connects them to an Academic Year, grade, and Terms; Enrollment owns student-specific materialization and selection. Record-level operations retain the precise Subject Offering domain name.
- Subject list reads derive JHS/SHS grouping and active Curriculum usage from existing grade and Offering relations only. Curriculum presents JHS as full Academic Year and keeps SHS classification, school-facing cluster, source/provenance, approval, and exact Term applicability explicit.
- Curriculum adoption is an explicit Super Admin-only workflow from Academic Year Details. It copies selected valid active Subject Offerings from an ACTIVE, LOCKED, or ARCHIVED source, including stable finalized Curriculum, into a different DRAFT destination; requires a complete one-to-one Term mapping; reuses Subjects; rejects source-only clusters; and resets copied SSHS contexts to destination-year review. Finalization, approval, and student-specific records are never copied.
- Academic Year management is available to Super Admin and Registrar through `Permissions.ACADEMIC_YEARS`; Registrar receives narrow `/dashboard/academic-years` shell access without general Dashboard permission.
- Operational module headers own the primary Add or lifecycle action. Table toolbars contain search and filters on the left and only existing Import actions plus approved or disabled Export controls on the right.
- The protected shell uses the shared sidebar provider and Base UI modal drawer: desktop state persists through the existing cookie, icon collapse retains tooltips, tablet/mobile navigation is transient below 1024px, and the sticky navbar supplies title, breadcrumbs, notifications placeholder, account controls, and the responsive trigger.
- Stable architectural principles are maintained in [`.ai/context/architecture.md`](../../.ai/context/architecture.md).

## Current Verification

- Phase 21F-B migrations `20260824014000_phase21f_b_jhs_grade_correction` and `20260824015000_phase21f_b_jhs_replacement_scope_hardening` are applied. The focused follow-up closes malformed Grade 7-10 replacement bypasses without changing SHS lifecycle behavior. All 53 migrations are applied with no Prisma schema drift.
- Focused Phase 21F-B and affected Phase 21F-A checks pass 54/54; disposable-database concurrency checks pass 2/2.
- Focused Phase 21F-C2 contract checks pass 4/4 and affected C1 contract/integration regressions pass 9/9. Prisma validation, TypeScript, targeted ESLint, and diff checks pass.
- Phase 21F-C3 complete sequential suite passes 367 tests with nine expected disposable-database concurrency skips and zero failures. The C1 checkout has no concurrency suite or environment gate; no disposable database is configured and shared development was not used.
- Phase 21F-D migrations are current with no schema drift. Focused 21F-D, 21D-C/D, and C1 regressions pass 31/31, with one expected result-revision concurrency skip because `C_RUN_CONCURRENCY` is not enabled for a disposable database. Prisma validation/generation, TypeScript, targeted ESLint, build, and diff checks pass. Protected counts remain Enrollment 4, Student 4, StudentSubjectEnrollment 28, StudentSubjectEnrollmentTerm 84, ShsTermResult 0, ShsTermResultRevision 0, Grade 0, and CurriculumCorrection 0.
- Phase 22A created protected `nemesysv2_walkthrough_template` and verified `nemesysv2_walkthrough_phase22a`. Both retain 6 Users, 3 Teachers, 203 Subjects (32 JHS and 171 source-backed SHS), 16 SHS clusters, and 171 SHS references while all operational and audit tables are empty. The source database migration identity and data fingerprints were unchanged.
- Phase 22C reset was reapplied through the guarded candidate build and atomic database-name swap. The final baseline has 1 preserved active Super Admin, 53 Subjects (32 active Grade 7-10, five Grade 11 Core, and sixteen curated Grade 11 elective definitions), exactly eight curated clusters, and zero rows in all operational, Offering/configuration, policy, reference, participation, result, correction, Grade, and audit tables. The candidate and final database passed exact Subject/cluster identity checks and byte-for-byte Super Admin preservation. Migration identity remains 59 applied migrations with checksum hash `6b40b78b6e2c0e5f4ad437400ed62b0a9ae4c5361342b0d241e50b0416b0a065`; Prisma status and schema diff report no drift. The original state is retained as `nemesysv2_phase22c_rollback_20260901062030` with fingerprint `49b1bf149f1472267d89c02c573829d13034d1d76be861b4188604dd62afbc97`.
- Superseded historical Phase 22D/23-A demo notes described six Sections, Grade 12 pilot Offerings, and synthetic approval references. They are not current state and must not be used as configuration or test expectations.
- Applied Phase 22D-A created the active 2026-2027 Academic Year with the approved three-Term calendar, five organizational Sections (Grades 7-11 A), 40 Offerings, 116 Offering-Term rows, and six elective-policy scopes. Phase 22D-B1 promoted the exact eight Grade 11 SHS Offerings to `SCHOOL_APPROVED` using `DepEd Order No. 017, s. 2026 – Strengthened Senior High School Curriculum`; no provisional SHS Offerings remain. Phase 22D-B2 finalized Curriculum through the controlled service, creating one `CurriculumFinalization` audit-backed event without changing the AY from ACTIVE. Dashboard Active Sections remains zero until active Enrollments exist, while organizational Sections remains five.
- Phase 23-A replaced legacy Subject Assignment identity (`Subject + Teacher + Section + Academic Year`) with exact `Subject Offering-Term + Section + Teacher` ownership. PostgreSQL enforces the Offering-Term composite foreign key and one active assignment per Offering-Term/Section with a partial unique index; archived records do not prevent a replacement. The migration aborts before destructive changes unless Subject Assignment is empty and its known constraints, indexes, triggers, and function dependencies match the reviewed baseline. Create validates an active Offering, exact Term applicability, active Academic Year, approved SHS context, matching active Section grade, and active Teacher/User. Initial assignments remain allowed in started Terms; ordinary updates and archives of started or historical Terms are blocked pending a future controlled reassignment/correction workflow. Schedule, room, and shift remain unchanged and unused.

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

- 22D-D Operational Verification follows C3-B: authenticated dashboard validation, Curriculum/readiness review, Grade 11/12 enrollment-readiness verification, and zero-state/history checks.
- Phase 23 Teacher Load & Bulk Subject Assignment is planned separately: AY/Grade assignment matrix, bulk Teacher assignment, Section fill, prior-year draft/template copy, downloadable Excel template, import/export, and duplicate/conflict validation.
- Future Curriculum Setup Acceleration is planned separately: downloadable Subject Offering Excel template, AY-aware import preview/validation, bulk Offering creation, Curriculum export, and retained AY-specific Subject Offering history.
- JHS E2-C expansion; repeat regular-JHS grade correction after historical replacement; specialized-program JHS, SHS, cross-program, cross-year, transferee-history, terminal-state, or other Enrollment-history correction; JHS participation outside the exact baseline; repeat SHS correction, Student Subject Enrollment migration, reinstatement, or generic reconciliation; result voiding/reopening or combined result-disposition plus participation correction; policy revision/versioning; split/merge, cross-year, or retire-without-successor Curriculum correction; Curriculum changes through student correction; prerequisites; subject completion rules; transferred credits; reusable cross-grade SHS Subject decisions; subject reinstatement; partial-Term Core withdrawal; completed subject status; Teacher completion; Subject Assignment modernization; JHS result modernization; legacy Grade migration; Scheduling; Attendance; `TermEnrollment`; Semester column retirement; automatic unattended progression/rollover; Enrollment reopening/archive/restore; cluster-code uniqueness redesign; destructive DepEd catalog cleanup; lifecycle vocabulary replacement; and graduation remain deferred to separately approved subphases. Teacher and Section import workflows; Subject, Teacher, Section, User, Enrollment, and academic-configuration export integrations; Academic Setup route consolidation; MFA; recovery; detailed login history; login throttling; breached-password checks; password history; and User archive/restore remain deferred to separately approved milestones.

## Technology Stack

- Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui, Lucide Icons
- TanStack Table and TanStack React Query
- Prisma and PostgreSQL
- SheetJS (`xlsx`) and Node.js

## Project Structure

The repository is feature-first with reusable UI centralized in `components/common` and Base UI primitives in `components/ui`. Main application layers are `app`, `actions`, `hooks`, `services`, `repositories`, `schemas`, `lib`, and `types`.
