# Phase 15E: User Account Lifecycle Completion

## Scope And Outcome

Phase 15E completes first-login password replacement and authenticated self-service password change for every User role, and modernizes the shared protected application shell for responsive navigation. It preserves the existing permission catalog, Teacher ownership, administrative User Management boundaries, Auth.js credentials provider, encrypted JWT strategy, feature routes, and layered application architecture.

MFA, password recovery, login throttling, breached-password checks, password history, account archive/restore, and detailed login history remain outside this phase.

## First-Login Enforcement

- New and administratively reset accounts retain `isFirstLogin: true` until they replace the temporary credential.
- Successful credentials authentication and authenticated visits to the login page enter `/account/complete-password` as a role-neutral dispatcher. Pending accounts remain there; completed accounts continue to their existing role destination.
- The encrypted session carries first-login state as an edge routing hint so freshly authenticated pending users cannot bypass the dispatcher with a direct page request. Central PostgreSQL revalidation remains authoritative.
- The protected application layout loads the centrally revalidated account and redirects pending users to `/account/complete-password` before rendering the normal application shell.
- `requireRole` and every existing permission check reject pending first-login accounts. The completion action uses authenticated-account authorization without introducing a permission category.
- The completion route is non-dismissible and redirects already-completed accounts to their existing role destination.
- Successful completion sets `isFirstLogin: false`, increments the session version, creates a `FIRST_LOGIN_COMPLETED` audit, and signs the user out to authenticate with the replacement password.

## Self Password Change

- The sidebar account menu exposes Change Password for every authenticated role, including Teacher accounts.
- The operation accepts no target User ID and derives the account exclusively from the revalidated session.
- The current password is verified with the existing asynchronous bcrypt helper and cost configuration.
- The replacement and confirmation must pass the shared policy, match each other, and differ from the current credential.
- Credential update and the `PASSWORD_CHANGE` audit commit or roll back in one service-owned transaction.
- Plaintext passwords, hashes, JWT claims, and password characteristics are never returned or audited.
- Successful changes sign out the current browser and require login with the replacement password.

## Password Policy

- Permanent passwords contain 6 to 64 Unicode code points and no more than 72 UTF-8 bytes, matching bcrypt's non-truncating input boundary.
- Unicode, whitespace, paste, and password-manager input remain allowed. No uppercase, lowercase, numeric, or symbol composition rules are imposed.
- Passwords are never trimmed or silently truncated.
- The policy is an immutable shared descriptor consumed by a schema factory so a future approved configuration source can replace the defaults without duplicating validation rules.
- Login, current-password verification, and Teacher temporary-password creation enforce the shared bcrypt byte boundary. Temporary credentials retain their existing separate minimum and generation rules.

## Session Safety

- `User.sessionVersion` defaults to zero and is included in the encrypted JWT/session contract.
- Central active-account authorization compares the JWT version with PostgreSQL on every protected request. Missing or older versions are unauthorized.
- Password reset and self-service password change increment the version atomically with the credential mutation, invalidating all previously issued sessions.
- Invalid protected sessions route through the existing same-origin session-invalidation endpoint before returning to login, preventing stale-JWT redirect loops.
- Administrative password reset is version-conditional so concurrent resets cannot both report usable temporary credentials.
- Administrators cannot reset their own password through User Management and are directed to the self-service operation. Existing Teacher ownership, self role/status, and active Super Admin continuity rules remain unchanged.

## Login History

- `lastLoginAt` continues to record the latest successful credential authentication, including authentication with a temporary password before first-login completion.
- Administrative reset preserves `lastLoginAt`; session revocation is represented by `sessionVersion` instead of erasing login history.
- A separate login-event model remains deferred until retention, privacy, failed-attempt, monitoring, and administrative-access requirements are approved.

## Audit

- `FIRST_LOGIN_COMPLETED` and `PASSWORD_CHANGE` identify the actor and target User, module `User`, record identity, and a concise outcome.
- Password-reset, first-login-completion, and self-password-change audits contain no credential or session-version values.
- Every credential mutation and its audit record share one service-owned transaction.

## Responsive Application Shell

- Desktop navigation uses the generated sidebar's icon-collapse mode. Expanded/collapsed state is written through the existing `sidebar_state` cookie and read by the protected server layout to avoid reload layout shifts.
- At widths below 1024px, navigation uses the generated Base UI modal Sheet as an overlay drawer. It is opened from the sticky navbar, closes after navigation, and resets when returning to desktop.
- Base UI retains focus trapping, focus restoration, outside dismissal, Escape handling, scroll locking, and the visible close control; no handwritten modal interaction system was introduced.
- Collapsed navigation retains icon labels through tooltips, an accessible toggle, and the existing `Ctrl/Cmd+B` shortcut.
- The sticky navbar provides a responsive page title, semantic breadcrumb, notifications placeholder, user dropdown, and navigation trigger.
- `SidebarInset` owns the semantic main region and uses `min-width: 0` and horizontal overflow containment so shell content resizes with the desktop sidebar without overlap.
- Existing role navigation definitions, routes, permissions, feature layouts, business logic, React Query state, and URL-driven server tables remain unchanged.

## Third-Party Verification

- No authoritative authentication, bcrypt, or password-policy MCP was exposed. OWASP Authentication Cheat Sheet guidance and the installed bcrypt 6 official contract were used as the fallback sources.
- The installed bcrypt contract confirms that only the first 72 UTF-8 bytes are used, so the shared boundary rejects longer inputs instead of truncating them.
- Installed Auth.js types and source confirmed encrypted JWT callback augmentation and the existing client/server sign-out contracts.
- Prisma skills, generated Client types, and CLI validation confirmed `Int @default(0)`, atomic increments, conditional `updateMany`, and service-owned interactive transaction usage.
- The shadcn MCP was unavailable. Official shadcn Sidebar documentation and the installed Base UI Dialog implementation confirmed icon collapse, controlled drawer state, modal focus management, Escape dismissal, and focus restoration.

## Reusable Knowledge

- Stable authorization guidance now records that credential mutations invalidate older JWTs through a database-backed session version and that first-login restrictions use revalidated database state rather than stale JWT claims.
- Stable shell guidance now records server-initialized desktop state, transient tablet/mobile drawers, and preservation of generated primitive accessibility behavior.
- No new skill or prompt guidance was needed.

## Verification

- `npx prisma validate` passed.
- `npx prisma generate` passed.
- `npx prisma migrate deploy` applied `20260804000000_add_user_session_version`, and `npx prisma migrate status` reports the database schema is current.
- A direct database read found three Users and no negative session versions after migration.
- Eight focused Node tests passed for permanent-password limits, preserved whitespace, Unicode handling, bcrypt byte limits, confirmation, current-password reuse, and Teacher temporary-password compatibility.
- Targeted ESLint passed without warnings for all changed TypeScript and TSX files.
- `npm run build` passed and includes `/account/complete-password` and `/session-invalid`.
- Browser verification was not run because the repository has no configured browser automation harness.

## Deferred Work

- MFA and password recovery.
- Distributed login throttling and persistent authentication-event monitoring.
- Breached-password checks and password history.
- Detailed login history and its retention, privacy, and administrative-access policy.
- User archive/restore and complete authorized filtered User export.
