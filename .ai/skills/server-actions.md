# Server Actions

## Responsibilities
- Mark action modules with `"use server"`.
- Validate untrusted input with Zod before calling a service.
- Enforce action-boundary authorization when required.
- Return the project's structured success/error response shape.

## Preferred Pattern
`parse input → reject invalid fields → call service → map expected errors → return response`

## Pitfalls
- Prisma or repository calls from actions.
- Business rules, transactions, or audit construction in actions.
- Returning sensitive exceptions or database details to clients.
