# Security Hardening Phase S3: Immediate Production Security

## Scope

Phase S3 applied production security controls that require no new infrastructure, database schema, migration, role, permission, feature, or Auth.js architecture change.

## Dependency Hardening

- Next.js and `eslint-config-next` are pinned to `16.2.12`, the latest stable Next.js 16 patch available during implementation.
- The package lockfile was refreshed.
- The upgrade removes the Next.js Proxy bypass and Server Action advisories affecting `16.2.10`.
- `npm audit --omit=dev` still reports 11 findings: 3 moderate and 8 high.

## HTTP Security Headers

All application responses receive:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `X-Frame-Options: DENY`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`

Dashboard and declared role page prefixes, together with all API routes, receive `Cache-Control: private, no-store, max-age=0`. CSP and HSTS were not introduced.

## Session And Cookie Policy

- Auth.js retains its encrypted JWT session strategy.
- The configured session and JWT maximum age is 28,800 seconds (8 hours).
- Auth.js cookie definitions remain unchanged.
- The installed Auth.js defaults set session cookies to `HttpOnly`, `SameSite=Lax`, path `/`, and `Secure` when the application URL uses HTTPS.
- Auth.js applies the configured session maximum age to JWT expiration and session-cookie expiration.

## Production Configuration

- Production startup fails when `AUTH_SECRET` or `DATABASE_URL` is missing or empty.
- Auth.js's existing `AUTH_URL` or legacy `NEXTAUTH_URL` canonical URL configuration is validated when supplied.
- A configured production canonical URL must be a valid absolute HTTPS URL.
- No new application URL environment variable is required because the repository did not previously configure one.
- Development configuration behavior remains unchanged.

## Administrator Bootstrap

- Initial `SUPER_ADMIN` creation requires `BOOTSTRAP_ADMIN_PASSWORD`.
- The bootstrap command checks for an existing administrator before requiring the secret, preserving idempotent seed behavior.
- The password is passed only to the existing password hasher and is never logged.
- The existing administrator identity, role, status, and duplicate check remain unchanged.

## Session Invalidation

- `POST /api/auth/session-invalid` requires an exact same-origin `Origin` header.
- Fetch Metadata must identify a same-origin request when `Sec-Fetch-Site` is available.
- Content types and non-empty request bodies are rejected because the endpoint accepts no input.
- Invalid requests receive a generic `403` response.
- Successful requests continue to use Auth.js `signOut({ redirect: false })`.
- Success and failure responses are marked `private, no-store`.

## Proxy Hardening

- Proxy authentication now requires a non-empty string user ID and a recognized `UserRole`.
- Missing or malformed identity and role claims are treated as unauthenticated.
- Redirects no longer use non-null role assertions.
- The proxy remains edge-safe and performs no database access.
- Central Action, Service, and API authorization remains the final security boundary.

## Accepted Vulnerabilities

The following audit findings remain accepted only for this approved phase:

- `xlsx` has high-severity prototype-pollution and ReDoS advisories with no npm-provided fix. Replacement was explicitly deferred.
- Next.js `16.2.12` remains reported through bundled `postcss` and `sharp` advisories. npm proposes a forced downgrade to Next.js `9.3.3`, which is incompatible and was not applied.
- Prisma tooling retains transitive `find-my-way` and `valibot` findings. Prisma dependency remediation was outside this phase.
- MCP and build-tool transitive dependencies retain `@hono/node-server` and `brace-expansion` findings. Automated broad dependency mutation was outside this phase.

These findings require reassessment in a dedicated dependency-remediation phase and are not considered permanently waived.

## Verification

- Targeted ESLint passed for all changed TypeScript files.
- `npx prisma validate` passed.
- `git diff --check` passed with LF-to-CRLF workspace warnings only.
- `npm run build` passed on Next.js `16.2.12`.
- `npm audit --omit=dev` completed and reported 11 residual findings: 3 moderate and 8 high.
- Production startup tests confirmed rejection of a missing `AUTH_SECRET` and a configured non-HTTPS application URL.
- Runtime checks confirmed all configured HTTP security headers.
- Runtime checks confirmed an originless invalidation request returns `403` and an empty same-origin request returns `200` with `private, no-store`.
- Cookie defaults were verified against the installed Auth.js implementation; a production HTTPS browser login was not performed.

## Deferred Security Work

- Distributed login rate limiting and brute-force protection
- CSP rollout
- Security event persistence and monitoring
- MFA, password reset, and password policy lifecycle
- Password hash migration
- `xlsx` replacement
- Broader dependency remediation
