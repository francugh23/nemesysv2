# PostgreSQL

## Preferred Patterns
- Let Prisma own ordinary application queries and writes.
- Use PostgreSQL-native constraints or indexes only when the domain rule is explicit and Prisma cannot represent it safely.
- Review null semantics, collation, concurrent writes, and migration locking before schema changes.

## Verification
- Prefer PostgreSQL MCP for behavior and DDL verification.
- Inspect generated SQL before applying consequential migrations.

## Pitfalls
- Assuming `NULL` participates in uniqueness like a normal value.
- Adding partial indexes or destructive constraints without rollout and historical-data analysis.
