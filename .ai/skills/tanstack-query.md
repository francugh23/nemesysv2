# TanStack Query

## Preferred Patterns
- Define stable, domain-specific query keys in hooks.
- Hooks call Server Actions and own query/mutation integration.
- Invalidate the narrowest relevant keys after a successful mutation.
- Represent loading, error, and empty states explicitly.

## Verification
- Confirm installed API behavior through TanStack Query MCP or official versioned docs.

## Pitfalls
- Fetching in presentation effects.
- Invalidating broad unrelated keys.
- Treating cached server state as local form state.
