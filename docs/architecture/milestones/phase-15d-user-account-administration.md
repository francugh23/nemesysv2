# Phase 15D: User Account Administration

## Scope And Outcome

Phase 15D completes administrative account operations in `/dashboard/users` without changing the Prisma schema, Auth.js configuration, JWT/session architecture, permissions catalog, Teacher ownership, or server-table behavior.

## Administration Operations

- Password reset, activation, deactivation, and role change are dedicated User operations with Server Action, service, repository, and hook boundaries.
- `Permissions.USERS` is enforced at the action and service boundaries. The current permissions catalog grants that permission only to `SUPER_ADMIN`.
- Teacher-role and Teacher-owned accounts remain exclusively managed through Teacher Management and are rejected by every administrative service operation.
- General User editing now covers identity and demographic fields only. Role and status changes use their dedicated safeguarded operations.

## Password Reset

- Resets generate an eight-character credential through the shared cryptographic temporary-password utility using `ABCDEFGHJKMNPQRSTUVWXYZ23456789`.
- The password is hashed through the existing bcrypt utility, and the User is updated with `isFirstLogin: true` and `lastLoginAt: null` in the same transaction as its audit entry.
- Plaintext exists only in the service return value and short-lived client dialog state. It is never persisted or audited.
- The confirmation dialog provides Copy and clears both local plaintext state and mutation state when closed, so the password cannot be retrieved afterward.

## Status And Role Safeguards

- An actor cannot change their own account status or role.
- Deactivation and role removal from an active `SUPER_ADMIN` account count active non-archived Super Admins inside the same serializable service-owned transaction before mutating.
- Operations that would leave no active Super Admin are rejected before the update and audit creation.
- Other Super Admin accounts remain eligible for role changes.

## Audit

- Password reset, activation, deactivation, and role change each create an audit record in the same transaction as the User update.
- Status and role updates use `changes: { field: { from, to } }` metadata.
- Password-reset audits record only the operation outcome; plaintext passwords, hashes, JWT/session data, and secrets are never included.

## UI And Query State

- The existing User row menu now exposes Edit, Change Role, Activate/Deactivate, and Reset Password actions.
- Dedicated controlled dialogs preserve the server-table URL state, filters, sorting, pagination, loading states, and placeholders.
- Successful operations invalidate the `['users']` prefix. The reset mutation uses zero garbage-collection time because it returns a one-time credential.

## Reusable Knowledge

- No new skill guidance was needed: the existing TanStack Query one-time-secret rule and audit metadata guidance already cover this implementation.

## Verification

- Targeted ESLint passed for all changed TypeScript and TSX files.
- `npx prisma validate` passed.
- `git diff --check` passed with LF-to-CRLF workspace warnings.
- `npm run build` passed and includes `/dashboard/users`.
- Focused schema checks confirmed administrative roles/statuses are accepted, `TEACHER` cannot be assigned through role administration, and general editing cannot submit a role.
- A 1,000-value generator smoke check confirmed every temporary credential is eight characters from the approved alphabet.
- A direct database read confirmed User list results contain no password hash and retain Teacher ownership metadata.
- Browser verification was not run.
