# React

## Preferred Patterns
- Keep components declarative and presentation-focused.
- Store state at the narrowest owner and derive values during render when possible.
- Use controlled inputs consistently and preserve stable identity when third-party components require it.
- Use effects only to synchronize with external systems, not to derive ordinary state.

## Project Fit
- Follow existing React Compiler guidance; do not add `useMemo` or `useCallback` reflexively.
- Put server-state behavior in hooks backed by TanStack Query.

## Pitfalls
- Mirrored state, effect-driven reset loops, unstable keys, and conditional hook calls.
- Mixing business rules into rendering code.
