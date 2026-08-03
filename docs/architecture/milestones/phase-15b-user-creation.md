# Phase 15B: User Creation

## Scope And Outcome

Phase 15B enables the Add User action introduced in Phase 15A and adds an authorized, audited creation workflow at `/dashboard/users`. The phase creates only `SUPER_ADMIN`, `REGISTRAR`, and `PRINCIPAL` accounts. Teacher accounts remain exclusively owned by Teacher Management.

User editing, activation/deactivation, password reset, deletion, archive/restore, and other lifecycle operations remain outside this phase.

## Create Contract

- The dialog collects employee number, username, email, first name, optional middle name, last name, gender, and role.
- The create schema excludes status, deletion state, password hash, and first-login state.
- The action validates the create contract with Zod before service delegation.
- The service independently enforces `Permissions.USERS` and the allowed administrative-role policy.
- New accounts are explicitly persisted with `status: ACTIVE` and `isFirstLogin: true`.
- Blank optional middle names are normalized to `null` before persistence.

## Credentials And Security

- Temporary passwords are generated only on the server with Node.js cryptographic randomness through the shared credential utility.
- Generated passwords contain eight uppercase alphanumeric characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, excluding `O`, `0`, `I`, `1`, and `L`.
- Passwords are hashed through the existing bcrypt helper and its configured cost before persistence.
- Neither the temporary password nor its hash is written to the audit log.
- The plaintext temporary password is returned only in the successful create response and displayed until the success dialog closes.
- The client mutation uses immediate garbage collection and resets after moving the credential into short-lived dialog state.
- First-login password replacement and password recovery remain deferred. If delivery of the one-time credential fails after commit, recovery requires the separately approved password-management phase.

## Uniqueness And Persistence

- Existing repository lookups validate employee number, username, and email uniqueness across all Users, including archived rows, matching the database's physical unique constraints.
- Friendly field-specific conflicts are returned for ordinary duplicate submissions.
- Prisma `P2002` is mapped to a safe generic identity-conflict message to handle concurrent creates without exposing database details.
- The existing transaction-aware `createUser` repository method is reused without changing repository contracts.
- The Prisma schema, Auth.js configuration, Teacher creation workflow, bcrypt configuration, and centralized authorization architecture remain unchanged.

## Audit And Query State

- The service owns one Prisma transaction containing both User creation and the `CREATE` audit record.
- Audit entries identify the actor, `CREATE` action, `User` module, created User ID and name, and created role without including credentials.
- Successful mutations invalidate the `['users']` prefix, refreshing parameterized lists and represented filter options.
- Failed actions do not invalidate queries.

## UI Decisions

- Add User is enabled in the User Management page header.
- The shared controlled form dialog and generated Base UI inputs/selects preserve existing project interaction patterns.
- The form is divided into account and personal information and excludes all server-owned fields.
- The dialog cannot be dismissed while creation is pending.
- Successful creation replaces the form with a one-time username and temporary-password view plus an explicit copy action.
- Form controls have associated labels, validation state, and error descriptions.

## Third-Party Verification

- The shadcn MCP was unavailable. Official shadcn Base UI Dialog and form documentation was used as the authoritative fallback, and existing generated primitives were reused unchanged.
- TanStack Query MCP was unavailable. Official TanStack Query documentation confirmed mutation success invalidation, and installed package source confirmed mutation `gcTime` and `reset` behavior for one-time response cleanup.
- Official Node.js crypto documentation confirmed `randomInt` as the cryptographic random source used by the reusable temporary-password generator.
- Official Zod documentation confirmed trimmed string, email, enum, and object validation behavior.

## Verification

- Targeted ESLint passed for all Phase 15B TypeScript and TSX files.
- TypeScript validation passed through the production build.
- `npx prisma validate` passed.
- `git diff --check` passed with LF-to-CRLF workspace warnings.
- `npm run build` passed and includes `/dashboard/users`.
- A direct schema smoke check confirmed valid administrative roles pass and `TEACHER` is rejected by the create boundary.
- Browser verification was not run.

## Deferred Work

- User editing and administrative identity correction.
- Activation/deactivation and last-active-administrator safeguards.
- First-login password replacement, password reset/recovery, and session revocation.
- User archive/restore or deletion policy.
- Complete authorized filtered User export.
