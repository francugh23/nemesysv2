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
Architectural Improvement Sprint – AI Infrastructure
## Current Objective
Maintain the completed AI operating infrastructure while Subject Assignment feature work remains frozen pending explicit approval.
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
## Subject Assignment Foundation
- Phase 8A – Subject Assignment Foundation is complete.
- The read path is schema → repository → service → server action → React Query hook → page.
- The read-only Assignment page is available at `/dashboard/assignments`.
- The flat read model includes Teacher employee number and full name; Subject code and description; Section grade level, track/strand, and section name; and academic year.
- The page uses the shared DataTable, sortable DataTableColumnHeader columns, and a dedicated loading skeleton.
- Phase 8B – Subject Assignment Creation implementation is present but feature work is frozen pending explicit approval to resume stabilization.
- Assignment creation uses the schema → action → service → repository path, with React Query invalidation for `['subject-assignments']` after successful creation.
- The Create Assignment dialog uses reusable searchable selectors for active Teachers, Subjects, and Sections.
- Searchable selectors keep primitive string IDs as their public, React Hook Form, and Base UI Combobox values; option objects are used only to resolve labels and filtering text.
- `SubjectAssignmentForm` uses React Hook Form `Controller` bindings instead of `form.watch` and `form.setValue` adapters, isolating controlled-field subscription and mutation lifecycles during dropdown selection and popup unmount; live Teacher and Subject selections retain their labels and IDs.
- End-to-end creation remains unverified because no Section options are currently available in the form.
- Creation requires an authenticated user, active related records, matching Subject and Section grade levels, and matching track/strand when the Subject specifies one.
- Active duplicate Teacher + Subject + Section + academic year assignments are rejected; creation and CREATE audit logging are transactional.
- Assignment edit, archive, import/export, scheduling, room, shift, timetable, curriculum, grades, and attendance remain out of scope.
## Next Planned Milestone
Resume Phase 8B – Subject Assignment Creation stabilization only after explicit approval.
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
