# Verification

## Required Baseline
- Run targeted ESLint for changed TypeScript/JavaScript files.
- Run `git diff --check`.
- Run relevant domain checks such as `npx prisma validate`.
- Run `npm run build` for completed implementation or infrastructure work.

## Quality Rules
- Add behavioral verification for the changed path; compilation is not behavior.
- Report commands, outcomes, warnings, and anything not run.
- Inspect the final diff for accidental generated or unrelated changes.

## Pitfalls
- Treating a build as proof of interaction correctness.
- Hiding skipped checks or environmental failures.
