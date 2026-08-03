# Phase 15A: User Management Modernization

## Scope And Outcome

Phase 15A created the authorized User Management read path at `/dashboard/users` and applied the reusable URL-driven server-table architecture established in Phases 10E-14. The phase is strictly listing-only: it adds no create, edit, activation, deactivation, password, archive, restore, or other lifecycle operation.

The Add User control is an intentionally disabled page-header placeholder. Export is an intentionally disabled table-toolbar placeholder. Neither control performs a partial or unapproved operation.

## Read Model And Security

- Reads require `Permissions.USERS` at both Server Action and service boundaries.
- User list and filter-option reads include only rows with `deletedAt: null`, including both active and inactive accounts.
- The repository projection exposes employee number, username, email, names, role, status, first-login flag, and creation time.
- Password hashes, authentication secrets, session data, and unrelated ownership relations are never selected.
- The Prisma schema, Auth.js configuration, password hashing, centralized authorization, and Teacher account ownership remain unchanged.
- No transaction or audit record is required because the phase performs no mutation.

## Server Table Contract

- URL parameters are `q`, `role`, `status`, `firstLogin`, `sort`, `direction`, `page`, and `pageSize`.
- Search is tokenized and case-insensitively matches employee number, username, email, first name, middle name, or last name. Every token must match at least one supported field.
- Role, Status, and First Login filters combine with logical AND.
- First Login accepts only the URL literals `true` and `false` before validation transforms the value to a Boolean.
- The Server Action validates the feature-owned query schema before service delegation.
- The repository owns filtering, projection, count, ordering, skip, and take. The service clamps pages beyond the filtered result.
- Responses include `items`, `totalCount`, resolved `page`, `pageSize`, and `pageCount`.

## Sorting Decisions

- Supported fields are Employee Number, Username, Name, Role, Status, First Login, and Created Date.
- Name ordering uses last name, first name, middle name, employee number, and User ID.
- Nullable employee and middle-name values use deterministic nulls-last ordering.
- Every explicit sort ends with User ID ascending so records remain stable between pages.
- The default order is Name ascending with the same stable tie-breakers.

## Filter Options And Query State

- Filter options contain only Role, Status, and First Login values represented by non-archived Users.
- List query keys are `['users', query]`; filter options use `['users', 'filter-options']`.
- `keepPreviousData` preserves rows during search, filter, sort, and page transitions.
- Out-of-range resolved pages reconcile back into the URL only after current query data arrives.

## UI Decisions

- The page header presents User Management, its description, and the disabled Add User placeholder.
- The table toolbar presents Search, Role, Status, First Login, and Reset on the left, with disabled Export on the right.
- Filters reuse the shared shadcn/Base UI Popover and Command composition.
- Initial loading uses the dedicated User table skeleton. List and filter-option errors are retryable, prior rows remain visible during background updates, and empty copy distinguishes no records from no matches.
- No Import control or workflow exists.

## Third-Party Verification

- The shadcn MCP was unavailable. Official shadcn Base UI Popover, Command, and Data Table documentation was used as the authoritative fallback, and existing generated/shared components were reused unchanged.
- Official TanStack Query documentation confirmed parameterized keys and `keepPreviousData` for paginated transitions.

## Verification

- Targeted ESLint passed for all Phase 15A TypeScript and TSX files.
- TypeScript validation passed through the production build.
- `npx prisma validate` passed.
- `git diff --check` passed with LF-to-CRLF workspace warnings.
- `npm run build` passed and includes `/dashboard/users`.
- A direct database read confirmed non-archived counts, Boolean filtering, represented options, pagination, and the restricted list projection.
- Browser verification was not run.

## Deferred Work

- Administrative User creation and role policy.
- User editing, activation/deactivation, archive/restore, and last-active-administrator safeguards.
- First-login completion, password change/reset, and session revocation workflows.
- Complete authorized filtered User export.
