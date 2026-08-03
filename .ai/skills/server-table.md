# Server Table

## Reference Pattern
- Enrollment is the reference implementation for URL-driven, server-backed tables.
- Keep generic URL state, controlled pagination/sorting, toolbar layout, faceted selects, reset behavior, and state rendering in shared hooks and components.
- Keep query schemas, filter names and options, Prisma filters, sort allowlists, and authorization inside the feature module.

## Query Flow
- Parse URL state into a feature query object.
- Include the normalized query in the feature-specific TanStack Query key.
- Validate the query in the Server Action before service delegation.
- Map public sort fields to Prisma ordering in the service; never pass arbitrary fields through.
- Repositories apply explicit active/history policy, filters, projection, ordering, count, skip, and take.
- Return items with total count, resolved page, page size, and page count.

## UX Rules
- Debounce search before updating the URL and reset to page one when search, filters, sorting, or page size changes.
- Preserve prior rows during query transitions and show background-fetch state without replacing the table.
- Distinguish an empty module from a filtered query with no matches.
- Use stable secondary ordering so records do not drift between pages.
- Preserve client-mode DataTable defaults until a module explicitly adopts server mode.

## Invalidation
- Parameterized list queries use a stable feature prefix such as `['enrollments', query]`.
- Mutations invalidate the feature prefix so every cached page and filter variant refreshes.
- Invalidate filter-option queries only when a mutation can change their values.
