# PROJECT_CONTEXT.md
# NEMESYS v2
## Project Overview
**Project Name:** NEMESYS v2
**Purpose:**
NEMESYS v2 is a School Information System for a Philippine Public High School supporting both:
- Junior High School (JHS)
- Senior High School (SHS)
The project is intended to become a long-term, production-grade information system rather than a CRUD demonstration project.
Development prioritizes:
- Maintainability
- Reusability
- Clean Architecture
- Incremental Feature Development
- Consistency Across Modules
---
# Document Purpose
This document represents the CURRENT state of the repository.
It is not intended to be a historical development log.
Whenever a milestone is completed, this document should be updated so that it always reflects the current implementation.
# Current Development Status
## Current Milestone
Section Management Module
## Current Objective
Complete final Section Management verification and knowledge promotion after the Phase 9C source implementation.
## Completed Milestones
✅ Student CRUD
✅ Student Module UI
✅ Student Import Framework
✅ Student Export Framework
✅ Phase 6A – Teacher Module Foundation
✅ Phase 6B – Teacher Creation
✅ Phase 6C – Teacher View & Edit
✅ Phase 6D – Teacher Deactivation
✅ Teacher CRUD Module
✅ Phase 7A – Subject Module Foundation
✅ Phase 7B – Subject Creation
✅ Phase 7C – Subject View & Edit
✅ Phase 7C.5 – Subject Identity Correction
✅ Phase 7D – Subject Archive
✅ Phase 7E – Subject Import
✅ Phase 7F – CRUD Toolbar Standardisation
✅ Phase 7F.1 – CRUD Toolbar Layout Refinement
✅ Phase 8A – Subject Assignment Foundation
✅ Phase 8A.1 – Shared DataTable Sorting Fix
✅ Phase 8B – Subject Assignment Creation
✅ Phase 9A – Section Foundation and Read Path
✅ Phase 9B – Section Creation and Adviser Management
✅ Phase 9C – Section View, Edit, and Archive
✅ Architectural Improvement Sprint – AI Infrastructure
✅ Workflow Improvement – Knowledge Promotion
✅ Repository production build verification (`npm run build`)
## AI Development Infrastructure
- The repository-level `AGENTS.md` is the AI operating manual and defines resource loading, approval gates, architecture, data policy, MCP-first verification, documentation, verification, and Git workflows.
- `.ai/context/architecture.md` contains stable architectural principles only; evolving implementation state remains in this document.
- `.ai/skills/` contains focused references for the project's framework, UI, data, layering, lifecycle, planning, verification, and investigation practices.
- `.ai/prompts/` is reserved for reusable workflows that reference current context instead of duplicating it.
- Third-party API proposals must be verified through an available authoritative MCP, with official documentation, installed types/source, or CLI output used as an explicit fallback.
- The Knowledge Promotion workflow preserves reusable implementation learning in repository documentation before conversation compaction or transition to another approved phase.
- Project knowledge continuously migrates from conversation history into repository documentation: the repository is long-term project memory, while conversation history is short-term working memory.
## Subject Identity Rules
- Active Subjects use a null-safe normalized identity: code, grade level, and track/strand.
- Subject codes and track/strand values are trimmed and stored uppercase; grade levels use canonical values `7` through `12`; blank and null track/strand values are equivalent.
- Grades 7 through 10 cannot have a track/strand. Grades 11 and 12 may omit one for shared/core Subjects or specify one for strand-specific Subjects.
- The null-safe active Subject identity migration was applied successfully after the redundant ENG8 Subject was archived. No SubjectAssignments or Grades required reassignment.
## Subject Archive Rules
- Subjects are archived through soft deletion using `deletedAt`; Subjects are never hard deleted.
- Archive requires `SUPER_ADMIN` authorization.
- Subjects with active SubjectAssignments cannot be archived.
- Grades, historical SubjectAssignments, and audit history are preserved when a Subject is archived.
- Archive actions create audit logs.
## Subject Import Rules
- Phase 7E – Subject Import is complete.
- The generic ImportWizard, spreadsheet parser, validation types, and wizard presentation components are reusable shared infrastructure.
- Student Import was migrated to the shared import framework through a Student feature wrapper.
- Subject Import uses the shared framework through a Subject feature wrapper with Subject-specific normalization, validation, server action, service, and repository behavior.
- Subject imports reuse normalized Subject identity rules, reject duplicate identities within the file, skip active identity collisions, and allow identities that match archived Subjects as new active records.
- Subject persistence and per-Subject audit logging are transactional; successful imports invalidate `['subjects']`.
## CRUD Toolbar Rules
- Phase 7F – CRUD Toolbar Standardisation is complete.
- Phase 7F.1 – CRUD Toolbar Layout Refinement is complete.
- Each module page owns its header title, description, and reusable CrudToolbar action row outside the records card.
- CrudToolbar renders inline secondary actions before the primary action and omits secondary controls when none are supplied.
- Student actions are Import Student, filtered Export, and Add Student; export uses the live filtered TanStack Table row model only.
- Subject actions are Import Subject and Add Subject; Teacher exposes only Add Teacher.
- Import dialogs use custom inline button triggers and retain their default trigger behavior when no trigger is supplied.
- Existing business logic, server actions, repositories, services, validation, audit logging, and React Query behavior remain unchanged.
## Shared DataTable Rules
- Phase 8A.1 – Shared DataTable Sorting Fix is complete.
- DataTable renders visible rows through `table.getRowModel().rows`, so filtering, sorting, and pagination operate together for Students, Teachers, Subjects, and Subject Assignments.
- Empty-state behavior continues to use filtered-row state.
- Student export intentionally uses `table.getFilteredRowModel().rows` so it includes all filtered records rather than only the current page.
- DataTable uses its existing shared empty-state and pagination behavior; feature-specific empty-state configuration remains deferred unless approved as a shared enhancement.
## Subject Assignment Foundation
- Phase 8A – Subject Assignment Foundation is complete.
- The read path is schema → repository → service → server action → React Query hook → page.
- The read-only Assignment page is available at `/dashboard/assignments`.
- The flat read model includes Teacher employee number and full name; Subject code and description; Section grade level, track/strand, and section name; and academic year.
- The page uses the shared DataTable, sortable DataTableColumnHeader columns, and a dedicated loading skeleton.
- Phase 8B – Subject Assignment Creation is complete.
- Assignment creation uses the schema → action → service → repository path, with React Query invalidation for `['subject-assignments']` after successful creation.
- The Create Assignment dialog uses reusable searchable selectors for active Teachers, Subjects, and Sections.
- Searchable selectors keep primitive string IDs as their public, React Hook Form, and Base UI Combobox values; option objects are used only to resolve labels and filtering text.
- `SubjectAssignmentForm` uses React Hook Form `Controller` bindings instead of `form.watch` and `form.setValue` adapters, isolating controlled-field subscription and mutation lifecycles during dropdown selection and popup unmount; live Teacher and Subject selections retain their labels and IDs.
- Verification passed. The current inability to complete an Assignment is expected because Section Management has not yet created any Section records; it is not a Phase 8B defect.
- Section Management is the prerequisite for populating the active Section selector and completing Assignment creation with real Section data.
- Creation requires an authenticated user, active related records, matching Subject and Section grade levels, and matching track/strand when the Subject specifies one.
- Active duplicate Teacher + Subject + Section + academic year assignments are rejected; creation and CREATE audit logging are transactional.
- Assignment edit, archive, import/export, scheduling, room, shift, timetable, curriculum, grades, and attendance remain out of scope.
## Next Planned Milestone
Phase 9D – Section Management final verification and knowledge promotion.
## Milestone Dependencies
Section Management is a foundational academic module. Its completion enables:
- Subject Assignment (active Section selection)
- Student Enrolment (Section placement)
- Adviser Assignment
- Class Lists
- Attendance
- Grades
## Section Management Plan
- Phase 9 implements full Section CRUD at `/dashboard/sections`: active-list read path, creation, view/edit, and soft archive. Import/export, restoration, enrolment workflows, scheduling, timetables, class lists, attendance, and grades remain out of scope.
- Section management is restricted to `SUPER_ADMIN` users, consistent with the existing Sections navigation visibility. Server Actions and services enforce this authorization; navigation visibility alone is not authorization.
- Section fields are grade level, track/strand, section name, optional adviser, optional room, and optional shift. The existing Section model is sufficient; no new Section attributes are required for Phase 9.
- Active Section identity is the normalized grade level, null-safe normalized track/strand, and normalized section name. Archived identities may be reused by a newly created active Section. A PostgreSQL partial unique expression index will enforce this rule.
- Grade levels use canonical values `7` through `12`. Grades 7 through 10 require a null track/strand. Grades 11 and 12 may omit a track/strand or use a trimmed uppercase value.
- Section names are trimmed, non-empty, and compared case-insensitively for active identity. Room is an optional informational field only; it has no scheduling, uniqueness, or additional validation rules. Section capacity is deferred to a future milestone.
- An adviser is optional and must reference an active Teacher. Adviser status is derived exclusively from active Section relationships; do not introduce, update, or persist `Teacher.isAdviser`.
- All Section mutations use the Components → Server Actions → Services → Repositories → Prisma → PostgreSQL flow. Services own authorization, normalization, transactions, dependency checks, and audit coordination; repositories own data access only.
- Creation, update, and archive mutations create transactional audit records identifying the actor, action, module, Section identity, and outcome.
- Archive sets `deletedAt` and never hard-deletes a Section. Active reads and form options explicitly exclude archived Sections. Archive is blocked when active SubjectAssignments or active Enrolments exist; historical relations and audit records are preserved.
- The Section page will use the existing CrudToolbar, DataTable, loading skeleton, dialog-manager, React Hook Form, Zod, toast, confirmation-dialog, and SearchableSelect patterns. Adviser selection uses primitive active Teacher IDs.
- Section hooks use `['sections']` and `['section-form-options']` keys. Successful mutations invalidate `['sections']`, `['section-form-options']`, and `['subject-assignment-options']`; dashboard invalidation is not part of Phase 9.
- Phase 9A: Section Foundation and Read Path: identity migration, schemas, repository/service/action/hook reads, and the active Sections page.
- Phase 9B: Section Creation and Adviser Management: active Teacher form options, transactional creation, identity enforcement, CREATE audit logging, creation dialog, and Assignment-option invalidation.
- Phase 9C: Section View, Edit, and Archive is complete: transactional updates, UPDATE audit logging, archive dependency checks, soft deletion, ARCHIVE audit logging, confirmation dialog, and archived-option exclusion.
- Phase 9D: Documentation and Knowledge Promotion: update current project context with completed rules and deferred work, promote reusable knowledge where needed, and complete final verification.
- Phase 9 verification includes targeted ESLint for changed TypeScript files, `npx prisma validate`, `git diff --check`, `npm run build`, and documented behavioral checks for identity, grade/strand, adviser eligibility, archive dependencies, audit records, cache refresh, and confirmation that archived Sections never appear in SearchableSelect or Section form options.
## Section Management
- Phase 9A, Phase 9B, and Phase 9C source implementation is complete. The active Section read path is repository → service → server action → `useSections` React Query hook → `/dashboard/sections`.
- Section reads require an authenticated `SUPER_ADMIN` at both the Server Action and service boundaries. The repository explicitly excludes archived records with `deletedAt: null` and returns only the fields required by the list.
- The flat Section list model contains grade level, track/strand, section name, optional adviser name, optional room, and optional shift. Adviser status is not read from or synchronized to `Teacher.isAdviser`.
- `/dashboard/sections` uses the shared CrudToolbar and DataTable, sortable columns, and dedicated loading, empty, error, and retry states. Row selection opens a read-only Section details dialog; row actions open edit and archive dialogs through the shared dialog-manager pattern.
- Create and Edit Section dialogs use React Hook Form, Zod, Controller-bound Base UI Selects, and a primitive-ID SearchableSelect populated only with active Teacher/User records. Adviser and room remain optional, room remains informational, and Section mutations do not read or synchronize `Teacher.isAdviser`.
- Section creation is restricted to `SUPER_ADMIN`, normalizes track/strand to uppercase and blank optional values to null, rejects JHS track/strand values, validates optional adviser activity inside the transaction, and does not read or persist `Teacher.isAdviser`.
- Creation checks active normalized Section identity before writing and relies on the approved PostgreSQL partial unique expression index for concurrency-safe enforcement. Section creation and its CREATE audit record commit or roll back together.
- Section updates reload the active record inside the service-owned transaction, normalize and preserve the approved active identity rule, validate an optional adviser as active, update the Section, and create an UPDATE audit record atomically.
- Section archive requires an active Section with no active SubjectAssignments and no non-deleted Enrolments in ACTIVE status. It sets `deletedAt` and creates an ARCHIVE audit record in the same transaction; it never hard-deletes or cascades lifecycle changes, and all historical relationships remain intact.
- Active Section reads, Section lists, Section form options, and Subject Assignment Section options explicitly exclude archived Sections. Successful create, update, and archive mutations invalidate `['sections']`, `['section-form-options']`, and `['subject-assignment-options']` only.
- Restore, capacity, import/export, scheduling, timetables, Student enrolment workflows, and Subject Assignment feature changes remain deferred.
- The null-safe active Section identity migration is authored as `20260729000000_section_identity_null_safe`. It normalizes Section identity values, rejects invalid or duplicate active data before modification, and defines a partial unique expression index for active grade level + track/strand + section name identities.
- Migration deployment remains pending because Prisma's Windows schema-engine process currently fails to launch with `spawn UNKNOWN`. This is an environmental limitation rather than a Phase 9C source implementation blocker; database-level concurrency enforcement of the active identity rule still requires the migration.
# Technology Stack
## Framework
- Next.js (App Router)
- React
- TypeScript
## UI
- TailwindCSS
- shadcn/ui
- Lucide Icons
## Tables
- TanStack Table
## Client Data
- TanStack React Query
## ORM
- Prisma
## Database
- PostgreSQL
## Spreadsheet Support
- xlsx (SheetJS)
## Runtime
- Node.js
# Project Structure
The project follows a feature-first architecture while keeping reusable UI centralized.
Main folders:
app/
actions/
components/
hooks/
lib/
repositories/
schemas/
services/
types/
docs/
Reusable UI:
components/common
Base UI:
components/ui
Business logic should remain separated through the existing layered architecture.
# Architecture
Application flow:
Components
↓
Server Actions
↓
Services
↓
Repositories
↓
Prisma
↓
PostgreSQL
## Components
Responsible for presentation only.
Business logic should never exist inside components.
---
## Server Actions
Responsible for:
- input validation
- authorization
- calling services
- returning structured responses
Business logic belongs to services.
---
## Services
Responsible for:
- business rules
- orchestration
- transactions
- authorization
Services coordinate repositories.
---
## Repositories
Responsible only for data access.
Repositories should never contain business rules.
---
## Database
Prisma is the only database access layer.
Related writes should use Prisma transactions whenever consistency is required.
