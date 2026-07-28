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
Phase 7 – Subject Module
## Current Objective
Implement the remaining Subject Module capabilities following the established module architecture.
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
✅ Repository production build verification (`npm run build`)
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
## Next Planned Milestone
To be determined.
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
