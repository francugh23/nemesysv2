# Phase 15C: User Account Editing

## Scope And Outcome

Phase 15C adds authorized, audited account editing to `/dashboard/users`. The workflow edits administrative User accounts while preserving User Management listing, creation, URL state, filters, sorting, pagination, toolbar controls, and placeholders.

Password reset/change, first-login completion, MFA, account recovery, archive/restore, and deletion remain outside this phase.

## Update Contract

- Editable fields are first name, optional middle name, last name, employee number, username, email, gender, role, and status only.
- The dedicated update schema excludes password hash, first-login state, deletion state, login history, and timestamps.
- Blank middle names normalize to `null` before comparison and persistence.
- No-op submissions are rejected without writing an update or audit record.
- Administrative roles remain `SUPER_ADMIN`, `REGISTRAR`, and `PRINCIPAL`; editing cannot assign the `TEACHER` role.

## Ownership And Authorization

- The Server Action and service independently require `Permissions.USERS`.
- Teacher-owned accounts are rejected by the service whether ownership is represented by the `TEACHER` role or an attached Teacher profile.
- Teacher rows expose a disabled Edit action with helper text directing administrators to Teacher Management.
- An actor editing their own account may change approved identity fields but cannot change their own role or status. The service enforces this rule using the revalidated actor ID, and the dialog disables the corresponding controls.
- Other administrative accounts, including other `SUPER_ADMIN` accounts, remain editable. No last-active-administrator rule was introduced.

## Data And Credential Boundaries

- List and update projections explicitly select only required account metadata and never select `passwordHash`.
- Credential lookup is isolated to the Auth.js authentication path, and the hash is consumed for verification but removed before the authentication service returns.
- User create and update repository responses now use credential-free projections.
- Employee number, username, and email uniqueness checks include archived Users, matching physical database constraints.
- Prisma `P2002` conflicts are mapped to a safe identity-conflict response for concurrent updates.
- The Prisma schema, Auth.js session strategy, JWT configuration, permissions catalog, and Teacher relationships remain unchanged.

## Transaction And Audit

- The service owns one interactive transaction containing target loading, ownership and self-edit policy checks, uniqueness checks, User update, and audit creation.
- Every successful edit creates one `UPDATE` audit entry for module `User` with actor attribution and the updated User identity.
- Audit metadata uses `changes: { field: { from, to } }`; nullable values use `NONE` and credentials are never recorded.
- A failed audit write rolls back the User update.

## UI And Query State

- Each User row exposes an actions menu. Eligible administrative rows open a controlled Edit User dialog using the existing `FormDialog`, React Hook Form, Zod, Base UI Select, and accessible Field patterns.
- A new dialog instance is created per selection so form defaults cannot leak between records.
- Dialog dismissal and submission are blocked while an update is pending.
- Successful updates invalidate the `['users']` prefix, refreshing parameterized lists and represented filter options without changing URL state.

## Temporary Credential Standard

- The Phase 15B temporary-password generator is now a reusable server utility for User creation and the future Phase 15D password-reset workflow.
- It generates eight characters with Node.js `randomInt` from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`; no password value is hardcoded.

## Third-Party Verification

- No authoritative MCP tools were exposed for this session. Official shadcn Base UI Dialog and React Hook Form documentation confirmed the existing controlled dialog, Field, Controller, Select, validation, and accessibility patterns.
- Official TanStack Query v5 documentation confirmed awaiting prefix invalidation from a successful mutation.
- Official Prisma documentation confirmed explicit selection, updates, and interactive transactions for atomic read-modify-write workflows.

## Verification

- Targeted ESLint passed for all changed TypeScript and TSX files.
- TypeScript validation passed through the production build.
- `npx prisma validate` passed.
- `git diff --check` passed with LF-to-CRLF workspace warnings.
- `npm run build` passed and includes `/dashboard/users`.
- Direct schema checks confirmed valid administrative updates pass and assigning `TEACHER` is rejected.
- A 1,000-value generator smoke check confirmed the eight-character alphabet boundary and produced no duplicate values in the sample.
- A direct database read confirmed User list results contain the derived Teacher ownership flag and no password hash.
- A focused implementation review found no remaining in-scope correctness or security findings.
- Browser verification was not run.

## Deferred Work

- Password reset/change and first-login completion.
- MFA and account recovery.
- User archive/restore and deletion policy.
- Last-active-administrator safeguards.
- Complete authorized filtered User export.
