# NEMESYS v2 AI Operating Manual

## Load Order
1. Read `docs/architecture/project-context.md` before every task. It is the source of truth for current state, decisions, and roadmap. Read it only once per session unless told it changed.
2. Read `.ai/context/architecture.md` for stable architectural constraints.
3. Load only the relevant files from `.ai/skills/` and `.ai/prompts/`.
4. Inspect the existing implementation before planning or editing.

If documentation and the repository differ, notify the user before making an implementation decision. Do not duplicate evolving project state outside `project-context.md`.

## Delivery Workflow
1. Establish scope and inspect existing patterns.
2. Identify applicable skills and authoritative MCP tools.
3. Produce an implementation plan for major work.
4. End with `Awaiting approval.` and do not implement until approved.
5. After approval, implement the smallest complete change, verify it, and report results.

Minor, explicitly requested changes may proceed without a separate approval round. Never resume frozen or deferred work without explicit approval.

## Architecture
Required flow:

`Components → Server Actions → Services → Repositories → Prisma → PostgreSQL`

- Components present data and collect input. They do not contain business or persistence rules.
- Server Actions validate input, enforce action-level authorization, call services, and return structured responses.
- Services own business rules, authorization orchestration, transactions, and audit coordination.
- Repositories perform data access only and accept a Prisma transaction client when participating in a transaction.
- Hooks own client query/mutation integration. Components do not call repositories, services, or Prisma.

See `.ai/context/architecture.md` and the layer-specific skills.

## Data Policies
- Services own transactions. Related writes and their audit logs must commit or roll back together.
- Auditable mutations create an audit record with actor, action, module, record identity, and clear description.
- Lifecycle-managed records use soft deletion. Active reads explicitly exclude archived rows.
- Never add hard deletion, cascading lifecycle changes, or uniqueness migrations without an approved domain decision.
- Successful mutations invalidate the narrowest relevant TanStack Query keys.

## MCP-First Policy
Before proposing or implementing third-party API usage, verify it with an available authoritative MCP. Priority:

1. shadcn/Base UI
2. Prisma
3. PostgreSQL
4. Next.js
5. TanStack Query

Do not reason from memory when an authoritative MCP is available. If no relevant MCP is available, use official vendor documentation, installed package types/source, or CLI output and state the fallback. Existing code is a project-pattern reference, not proof of a third-party contract.

## Documentation
- `docs/architecture/project-context.md` records evolving implementation state and decisions.
- `.ai/context/architecture.md` contains only stable architectural principles.
- Update `project-context.md` after a successfully completed approved milestone or architectural sprint, before declaring it complete.
- Do not turn `project-context.md` into a chronological development log.

## Verification
- Run targeted ESLint for changed TypeScript/JavaScript files.
- Run `git diff --check`.
- Run domain checks when applicable, including `npx prisma validate` for Prisma work.
- Run `npm run build` for completed implementation or infrastructure work.
- Report any check that could not run. A passing build does not replace behavioral verification.

## Git Workflow
- Inspect status and diffs before commits.
- Never revert unrelated or user-authored changes.
- Never use destructive Git commands without explicit approval.
- Commit, amend, push, or open a pull request only when explicitly requested.
- Stage only intended files and never commit secrets.

## Priorities
1. Correctness
2. Maintainability
3. Consistency
4. Reusability
5. Minimal change

Build reusable systems while following established repository patterns.
