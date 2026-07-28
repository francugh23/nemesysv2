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
Phase 6 – Teacher Module
## Current Objective
Implement the remaining Teacher Module capabilities following the architecture established by the Student Module.
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
✅ Repository production build verification (`npm run build`)
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
