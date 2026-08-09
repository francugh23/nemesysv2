# Phase 18A: Query Cache Coherence

## Scope And Outcome

Phase 18A fixes stale dependent TanStack Query option caches without changing academic domain behavior. Teacher, Subject, and Student mutations now own the invalidation of their list queries and the selectors supplied by those records.

The known Teacher selector defect is resolved by invalidating the Subject Assignment and Section option queries after a successful Teacher create, update, or deactivate mutation. Cached open selectors refetch through their existing query hooks; no router refresh, page reload, remount, stale-time change, or direct component fetch is used.

## Mutation Ownership And Query Dependencies

- Teacher mutations invalidate `['teachers']`, `['subject-assignment-options']`, and `['section-form-options']`.
- Subject mutations invalidate `['subjects']` and `['subject-assignment-options']`.
- Student mutations invalidate `['students']` and `['enrollment-form-options']`.
- Section mutations retain their existing `['sections']`, `['section-form-options']`, `['subject-assignment-options']`, and `['enrollment-form-options']` dependency set.
- The shared Import Wizard accepts optional feature-owned dependent query keys in addition to its existing primary list key.

The focused `hooks/query-invalidation.ts` helper contains only the tested dependency sets. Feature mutation hooks invoke those helpers after successful Action responses. Components no longer call Teacher, Subject, or Student mutation Actions or invalidate queries directly.

## Preserved Boundaries

- Server Actions, Services, Repositories, Prisma schema, permissions, authorization, audits, validation, normalization, URL table state, sorting, and pagination are unchanged.
- Import behavior remains unchanged. Student import additionally refreshes Enrollment form options, and Subject import additionally refreshes Subject Assignment options.
- Existing Teacher import and reactivation workflows do not exist and were not introduced in this cache-coherence-only subphase.
- Existing Subject restore and Student restore workflows do not exist and were not introduced.

## Verification

- Focused invalidation tests cover Teacher, Subject, Student, Section, and Import Wizard dependency sets.
- Targeted ESLint passed.
- `npx prisma validate` passed.
- `git diff --check` passed with LF-to-CRLF workspace warnings only.
- `npm run build` passed.
- Manual browser verification was not run because this environment has no browser automation harness or authenticated test account. It remains required before a production release.

## Reusable Knowledge

No `.ai` skill was added. The existing Section milestone already documents invalidating dependent option queries after source mutations; Phase 18A applies that established pattern consistently.
