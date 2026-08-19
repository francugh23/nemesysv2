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
- Cross-domain administrative summaries remain read-only Service projections. Permission-gated facts are queried and returned only for authorized callers, and multi-query summaries that must agree use a consistent database snapshot.

Do not bypass a layer to save code.

## Transactions
- The service layer owns transaction boundaries.
- All writes required for one business operation must commit or roll back together.
- Repository methods participating in a transaction accept and use the provided transaction client.

## Authorization
- Protected Server Actions perform boundary authorization before validation or service delegation.
- Services independently perform final authorization before business rules or data access.
- Permissions map to allowed roles in one central catalog; feature modules authorize by permission rather than hardcoded role checks.
- Central authorization revalidates account existence, active status, soft-deletion state, and current role once per protected request.
- Credential mutations increment a database-backed session version. Central authorization rejects older JWT sessions, and successful password changes require reauthentication.
- First-login state is enforced from the revalidated database account. Pending accounts may access only authenticated account-completion paths, not role- or permission-protected operations.
- Repositories never import authentication or authorization concerns.
- Protected API routes authorize directly; proxy protection is defense in depth only.

## Record Lifecycle
- Domain records with history use soft deletion through `deletedAt`.
- Active reads explicitly filter archived records.
- Historical relations and audit records are preserved.
- Restore, archive, hard-delete, and active-only uniqueness behavior require deliberate domain rules.

## Audit Logging
- Material mutations are auditable.
- Audit creation belongs in the same transaction as the mutation.
- Logs identify the actor, operation, module, record, and human-readable outcome without storing secrets.

## Exports
- Complete filtered exports reuse the feature's validated server-table query rather than exporting loaded page rows.
- Feature Server Actions and Services independently enforce the existing module permission before export data access.
- Services own export orchestration and pass explicit ordered projections to shared format generators.
- Repositories apply feature-owned filtering and deterministic ordering and select only approved export fields.
- Client-controlled export columns and direct persistence access are prohibited.

## General Conventions
- PostgreSQL is the system of record; Prisma is the only application database access layer.
- Zod validates external input at boundaries.
- TanStack Query manages client server-state and targeted invalidation.
- Prefer generated shadcn/Base UI primitives and established project components over handwritten interaction primitives.
- Responsive application shells reuse the generated sidebar and modal primitives: server-readable state initializes desktop layout, transient drawers own tablet/mobile interaction, and primitive-provided focus, dismissal, and keyboard behavior remains intact.
- Keep evolving feature status and decisions in `docs/architecture/project-context.md`, not this file.

## Project Memory
- Project knowledge continuously migrates from conversation history into repository documentation.
- The repository is the project's long-term memory; conversation history is short-term working memory.
- Reusable knowledge is promoted before conversation compaction or transition to a new approved phase.
- Stable principles belong here, reusable practices belong in `.ai/skills/` or `.ai/prompts/`, and evolving state belongs in `docs/architecture/project-context.md`.
