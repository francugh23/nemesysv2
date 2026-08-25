# Phase 21F-C2: SHS Participation Correction Read And UI

## Scope And Outcome

Phase 21F-C2 exposes the approved C1 command through an authorized, server-derived Enrollment Details workflow. It does not change the C1 PostgreSQL protocol, function, capability, or immutable event model.

## Read And Mutation Rules

- `Permissions.STUDENT_CORRECTIONS` protects correction context, exact source-Term preview, history, and mutation at Action and Service boundaries.
- The preview derives Core remaining-Term scope and elective exact-Term scope from the selected immutable source membership, reports source result state and elective policy, and lists only active school-approved, classification-compatible replacement candidates that cover the exact scope.
- Server filtering excludes source identity, active duplicates, unavailable cluster context, and DROPPED Offering identities or compatible ancestors. Source, lifecycle, result, policy, and completed-Term blockers remain explicit in the preview.
- Once the authoritative selected Academic Term has started, the application requires the exact typed source-participation phrase before invoking the unchanged C1 function-backed command.
- SHS subject correction history is distinct from Enrollment placement and grade-level correction history. Successful mutations invalidate only the Enrollment participation, progression, C2 context/preview/history keys.

## Verification

- C1 contract and integration regressions, focused C2 contracts, TypeScript, targeted ESLint, Prisma validation, and diff checks pass.
