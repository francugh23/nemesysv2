# Security Hardening Phase S1: Authorization Architecture

## Scope

Phase S1 established the permanent permission-based authorization architecture without changing authentication, sessions, business rules, UI, roles, or the database schema.

## Architecture

- `lib/permissions.ts` is the edge-safe permission catalog and the single permission-to-role mapping.
- `lib/authorization.ts` is server-only and provides `AuthorizationError`, `requireAuthenticatedUser()`, `requireRole()`, and `requirePermission()`.
- Protected Server Actions perform boundary authorization before validation or service delegation.
- Services independently perform final authorization and remain responsible for business rules and transactions.
- Repositories remain authorization-free and perform data access only.
- Protected API routes authorize directly; proxy checks remain defense in depth.

## Current Permission Policy

The catalog defines permissions for Users, Audit Logs, Dashboard, Students, Teachers, Subjects, Subject Assignments, Sections, Enrollment, Grades, Attendance, and Report Cards. During Phase S1, every permission grants access only to `SUPER_ADMIN`.

Registrar, Principal, and Teacher permissions require separate approved domain decisions and remain deferred.

## Migrated Boundaries

- Students, including import
- Teachers
- Subjects, including import
- Subject Assignments and form options
- Sections and form options
- Enrollment and form options
- Dashboard API and service

## Preserved Behavior

- Auth.js login and session handling are unchanged.
- Existing feature business rules and transaction boundaries are unchanged.
- Audit actor identities continue to come from the authorized server session.
- Navigation and UI behavior are unchanged.
- No Prisma schema or migration changes were introduced.

## Deferred Security Work

- Session revocation and active-account revalidation
- Login rate limiting and abuse monitoring
- Secure initial administrator bootstrap
- Security headers
- First-login and password reset workflows
- Dependency vulnerability remediation
