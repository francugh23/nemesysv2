# AGENTS.md
# NEMESYS v2 AI Instructions
## Source of Truth
Before starting ANY task, read:
docs/architecture/project-context.md
This document is the authoritative source for:
- current development phase
- architecture
- completed features
- roadmap
- coding conventions
- project decisions
Do not contradict it without explicit approval.
Acknowledge once you have finished reading.
Do not summarize unless I explicitly ask.
If the repository differs from `docs/architecture/project-context.md`, notify me before making implementation decisions.
---
## Workflow
For every task:
1. Read project-context.md.
2. Within the current session, do not reread `project-context.md` unless I indicate it has changed.
3. Inspect existing implementation patterns.
4. Identify applicable MCP tools or Skills.
5. Produce an implementation plan.
6. Wait for approval before major implementation.
7. Verify changes after implementation.
---
## Architecture
Always follow:
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
Do not bypass layers.
---
## UI
Prefer:
- shadcn/ui
- reusable components
- existing project patterns
---
## Data
Use:
- Prisma
- PostgreSQL
- React Query
Always invalidate React Query after successful mutations.
---
## Documentation
After successfully completing any approved development phase or milestone, update `docs/architecture/project-context.md` so it accurately reflects the repository's current state before considering the task complete.
---
## Final Rule
Prioritize:
1. Correctness
2. Maintainability
3. Consistency
4. Reusability
5. Follow the existing coding patterns of this repository.
Build systems, not one-off solutions.