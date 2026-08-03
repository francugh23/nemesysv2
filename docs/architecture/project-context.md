# PROJECT_CONTEXT.md
# NEMESYS v2

## Document Purpose

This document is the repository's current operational state. It is not implementation history. Load the relevant milestone document under [`milestones/`](./milestones/) for completed feature decisions, validation, verification, and deferred work.

## Current Development Status

### Current Milestone

No active implementation milestone. Enrollment Management Phase 10D is complete.

### Current Objective

No active implementation objective. Enrollment lifecycle synchronization and controlled cross-grade correction are complete.

### Completed Modules

- Student CRUD, UI, import, and export
- Teacher CRUD
- Subject CRUD, identity correction, archive, and import
- Shared CRUD toolbar and DataTable sorting improvements
- Subject Assignment foundation, creation, view, edit, and archive
- Section Management foundation, creation, view, edit, and archive
- Enrollment Management foundation, read path, creation, details, edit, status lifecycle, Student summary synchronization, and controlled cross-grade correction
- Security Hardening Phase S1 centralized authorization architecture
- Security Hardening Phase S2 active-account revalidation
- Security Hardening Phase S3 immediate production security

### Milestone Records

- [Phase 08: Subject Assignment](./milestones/phase-08-subject-assignment.md)
- [Phase 09: Section Management](./milestones/phase-09-section-management.md)
- [Phase 10: Enrollment Management](./milestones/phase-10-enrollment.md)
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
- Central authorization performs one request-scoped active-user lookup and evaluates permissions using the current database role.
- Production responses apply standard browser security headers; authenticated route families and APIs are private and non-cacheable.
- Auth.js retains encrypted JWT sessions with an explicit 8-hour maximum age and default secure cookie behavior.
- Production startup validates required secrets, database configuration, and any configured canonical Auth.js URL.
- Enrollment is the operational lifecycle source of truth. Student status and current Section are synchronized summaries maintained transactionally by `EnrollmentService`.
- Student current placement is normalized through nullable `currentSectionId`; grade, track/strand, shift, adviser, and other placement details are derived from Section.
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

No next milestone is active or approved.

## Technology Stack

- Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui, Lucide Icons
- TanStack Table and TanStack React Query
- Prisma and PostgreSQL
- SheetJS (`xlsx`) and Node.js

## Project Structure

The repository is feature-first with reusable UI centralized in `components/common` and Base UI primitives in `components/ui`. Main application layers are `app`, `actions`, `hooks`, `services`, `repositories`, `schemas`, `lib`, and `types`.
