# Audit Logging

## Policy
- Audit material domain mutations.
- Write the audit record in the same service-owned transaction as the mutation.
- Record actor, action, module, record ID/name, and a concise human-readable description.
- Use metadata only for useful structured context.
- For audited corrections, record changed fields as `changes: { field: { from, to } }`; normalize nullable values to a readable sentinel such as `NONE`.

## Pitfalls
- Logging passwords, tokens, or unnecessary personal data.
- Auditing a write after its transaction commits.
- Vague descriptions that do not identify the outcome.
