# Server Table

## Reference Pattern
- Enrollment is the reference implementation for URL-driven, server-backed tables.
- Keep generic URL state, controlled pagination/sorting, toolbar layout, faceted selects, reset behavior, and state rendering in shared hooks and components.
- Keep query schemas, filter names and options, Prisma filters, sort allowlists, and authorization inside the feature module.

## Query Flow
- Parse URL state into a feature query object.
- Validate boolean URL filters as explicit `"true"` and `"false"` literals before transforming them; do not use boolean coercion for query-string values.
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
- Keep the module's primary Add or lifecycle action in the page header. Reserve the table toolbar for Search, primary lifecycle/status filter when applicable, domain filters, and Reset on the left, with existing Import actions and a disabled Export placeholder on the right.
- Do not invent a string sentinel for nullable filters when it can collide with valid domain data. Expose represented non-null values unless the feature defines an explicit collision-safe nullable-filter contract.

## Invalidation
- Parameterized list queries use a stable feature prefix such as `['enrollments', query]`.
- Mutations invalidate the feature prefix so every cached page and filter variant refreshes.
- Invalidate filter-option queries only when a mutation can change their values.
- When filter options are derived from the same records and share the same invalidation lifecycle, place them under the feature prefix, such as `['students', 'filter-options']`.

## Specialized Ordering
- When a displayed numeric value is stored as a related string, use a parameterized raw query for the ordered page of record IDs only, then hydrate those records through Prisma and restore the returned ID order.
- Keep raw-query filters identical to the count and ordinary list filters so pagination metadata and rows cannot diverge.
