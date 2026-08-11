# Phase 18C-3: Regular JHS Baseline Population

## Scope And Outcome

The clean development database received 32 grade-specific regular JHS Subject definitions and 32 corresponding full-year Subject Offerings for Academic Year 2026-2027. Every Offering links to Term 1, Term 2, and Term 3.

## Baseline

- Grades 7 through 10 each contain Filipino, English, Mathematics, Science, Araling Panlipunan, MAPEH, TLE, and GMRC / Values Education.
- Subject codes use approved internal identifiers: `FIL`, `ENG`, `MATH`, `SCI`, `AP`, `MAPEH`, `TLE`, and `GMRC` plus grade level.
- Subject descriptions use the approved category names.
- The identifiers are internal NEMESYS/SOLARIS values only and are not asserted as official DepEd or NVGCHS codes.

## Preserved Boundaries

- No STE, SPED, SPA, SPS, SPFL, SHS, or other specialized-program Subject or Offering was created.
- No Subject Assignment, Enrollment, Student Subject Enrollment, Grade, Scheduling, Academic Year, or Academic Term record was created or modified.
- Each Subject and Offering received a transactional audit record under the active Super Admin actor.

## Verification

- Focused baseline matrix, Offering, cache, and Assignment-read tests passed.
- Prisma validation, generation, and migration status passed.
- Targeted ESLint, `git diff --check`, and production build passed.
- Authenticated browser verification remains required before production release.
