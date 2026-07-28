# shadcn/ui

## Preferred Patterns
- Verify components through the shadcn MCP or current registry before implementation.
- Generate primitives with the configured project style, then compose them in feature components.
- Preserve generated accessibility and interaction behavior.
- Match existing spacing, typography, and variant conventions.

## Pitfalls
- Recreating an official primitive by hand.
- Overwriting customized generated files without reviewing the diff.
- Assuming examples for a different shadcn foundation match this Base UI project.
