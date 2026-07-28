# Stable Architecture

## Scope
- NEMESYS v2 serves one school. Do not introduce multi-school tenancy or tenant identifiers without an explicit architectural decision.
- Prefer cohesive modules and reusable shared infrastructure over one-off implementations.

## Layers
The application flow is:

`Component → Server Action → Service → Repository → Prisma → PostgreSQL`

- Components are presentation-only and use hooks for server state.
- Server Actions validate untrusted input, perform action-boundary authorization, delegate to services, and return structured results.
- Services own business policy, orchestration, authorization decisions, transactions, and audit coordination.
- Repositories own Prisma data access only. They do not make business decisions.
- Hooks encapsulate TanStack Query keys, queries, mutations, and invalidation behavior.

Do not bypass a layer to save code.

## Transactions
- The service layer owns transaction boundaries.
- All writes required for one business operation must commit or roll back together.
- Repository methods participating in a transaction accept and use the provided transaction client.

## Record Lifecycle
- Domain records with history use soft deletion through `deletedAt`.
- Active reads explicitly filter archived records.
- Historical relations and audit records are preserved.
- Restore, archive, hard-delete, and active-only uniqueness behavior require deliberate domain rules.

## Audit Logging
- Material mutations are auditable.
- Audit creation belongs in the same transaction as the mutation.
- Logs identify the actor, operation, module, record, and human-readable outcome without storing secrets.

## General Conventions
- PostgreSQL is the system of record; Prisma is the only application database access layer.
- Zod validates external input at boundaries.
- TanStack Query manages client server-state and targeted invalidation.
- Prefer generated shadcn/Base UI primitives and established project components over handwritten interaction primitives.
- Keep evolving feature status and decisions in `docs/architecture/project-context.md`, not this file.

## Project Memory
- Project knowledge continuously migrates from conversation history into repository documentation.
- The repository is the project's long-term memory; conversation history is short-term working memory.
- Reusable knowledge is promoted before conversation compaction or transition to a new approved phase.
- Stable principles belong here, reusable practices belong in `.ai/skills/` or `.ai/prompts/`, and evolving state belongs in `docs/architecture/project-context.md`.
