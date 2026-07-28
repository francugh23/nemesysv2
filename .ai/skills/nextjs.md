# Next.js

## Preferred Patterns
- Use the App Router and preserve existing route-group conventions.
- Default to Server Components; add `"use client"` only for state, effects, browser APIs, or interactive hooks.
- Keep mutations in Server Actions and data/business logic in lower layers.
- Use framework primitives for navigation, loading, errors, and metadata.

## Before Implementing
- Verify the installed Next.js API through its MCP, official documentation, or installed types.
- Inspect nearby routes for project conventions.

## Pitfalls
- Importing server-only modules into client bundles.
- Treating route components as service or repository layers.
- Adding caching or revalidation behavior without understanding TanStack Query ownership.
