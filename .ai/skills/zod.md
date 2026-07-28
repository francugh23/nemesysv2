# Zod

## Preferred Patterns
- Define schemas at trust boundaries and infer TypeScript types from them.
- Normalize trim, case, blank/null, and coercion behavior deliberately.
- Reuse schemas where create/update contracts truly match; split them when semantics differ.
- Return user-safe validation feedback from Server Actions.

## Pitfalls
- Duplicating validation as disconnected TypeScript types.
- Encoding database access or authorization inside schemas.
- Treating client validation as sufficient server validation.
