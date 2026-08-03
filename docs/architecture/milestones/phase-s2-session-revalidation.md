# Security Hardening Phase S2: Session Revalidation

## Scope

Phase S2 added centralized runtime account revalidation without changing Auth.js providers, JWT/session callbacks, permission mappings, feature business rules, or the database schema.

## Architecture

- `requireAuthenticatedUser()` remains the single active-account authorization boundary.
- The JWT establishes session identity only. Authorization reloads that identity through `findActiveUserById()` before trusting it.
- The active-user query requires `deletedAt: null` and `status: ACTIVE`, and selects only ID, role, and status.
- The database role replaces the JWT role in the validated session returned to `requireRole()` and `requirePermission()`.
- React request-scoped caching deduplicates Action and Service authorization so one protected request performs one active-user lookup.
- Feature Actions and Services retain their independent permission checks without adding User queries.
- Repositories remain data-access only and do not make authorization decisions.

## Invalid Sessions

- Missing, deleted, and inactive users produce `AuthorizationError` with status `401`.
- Protected Server Actions retain their structured `Unauthorized.` responses.
- Protected APIs retain JSON `401` responses.
- The shared browser API client handles `401` by posting to `/api/auth/session-invalid`, which uses Auth.js `signOut({ redirect: false })` to clear the JWT cookie before navigating to `/auth/login`.
- The sign-out endpoint is under the existing `/api/auth` proxy exception, so a stale JWT cannot redirect it back to the dashboard.

## Preserved Boundaries

- `app/(protected)/layout.tsx` remains presentation and SessionProvider infrastructure only.
- Proxy and Auth.js callbacks remain edge-safe and perform no database access.
- No feature module performs its own active-account lookup.
- No transaction, audit record, Prisma schema change, or migration was introduced.

## Authorization Query Inventory

- `lib/authorization.ts` imports only `findActiveUserById()` for authorization state.
- `services/auth.service.ts` uses the username query only for credentials authentication.
- Teacher service User queries enforce employee-number, username, and email uniqueness; they are business validation rather than authorization.

## Manual Verification Checklist

- Login as `SUPER_ADMIN` and confirm all dashboard modules remain functional.
- Confirm one active-user lookup serves both Action and Service checks in one request.
- Set the account to `INACTIVE`; confirm protected Actions return `Unauthorized.` and protected APIs return `401`.
- Confirm a browser API `401` clears the Auth.js cookie and navigates to `/auth/login` without a loop.
- Restore `ACTIVE` and confirm login succeeds again.
- Soft-delete the account and repeat the unauthorized/sign-out verification.
- Change the database role and confirm the next protected operation uses the new permission outcome.
- Confirm feature modules contain no authorization-related User lookup.

## Verification

- Targeted ESLint passed for Phase S2 TypeScript files.
- `npx prisma validate` passed.
- `git diff --check` passed with LF-to-CRLF workspace warnings.
- `npm run build` passed and includes `/api/auth/session-invalid`.
- Browser, database-state, cookie-clearing, and request query-count verification were not run.

## Deferred Security Work

- Login rate limiting and abuse monitoring
- Secure initial administrator bootstrap
- Security headers
- First-login and password reset workflows
- Dependency vulnerability remediation
