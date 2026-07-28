# Soft Delete

## Policy
- Lifecycle-managed records are archived with `deletedAt`, not hard-deleted.
- Active reads explicitly require `deletedAt: null`.
- Preserve historical relations, grades, assignments, and audit history.
- Services enforce archive eligibility and authorization.

## Pitfalls
- Assuming ordinary unique constraints allow reuse of archived identities.
- Cascading archive state without an approved domain rule.
- Naming an archive operation `delete` when behavior is soft deletion.
