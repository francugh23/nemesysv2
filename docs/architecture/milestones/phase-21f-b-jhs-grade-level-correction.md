# Phase 21F-B: Regular JHS Grade-Level Correction

## Scope And Outcome

Phase 21F-B adds a controlled administrative correction for an active regular JHS Enrollment placed in the wrong Grade 7-10 grade and Section. It preserves the same Enrollment identity and old participation evidence while creating a separate full-year destination-grade baseline.

The command is distinct from Phase 21F-A same-grade Section correction, which remains unchanged and preserves participation without replacement. It is available only to Super Admin and Registrar through `Permissions.STUDENT_CORRECTIONS` at both Action and Service boundaries.

## Correction Rules

- Enrollment, Academic Year, Student, source Section, and destination Section must be active; the Student must be enrolled in and synchronized to the source Section.
- Source and destination must be distinct regular JHS Grade 7-10 Sections in different grades. SHS, specialized-program, entry-Term, and SHS Track facts are excluded.
- Source participation must be either zero rows or exactly the eight active grade-specific baseline subjects, each covering all configured Academic Terms and matching immutable Offering evidence.
- Any existing `REPLACED` or `DROPPED` participation history blocks correction, including a repeat correction after historical replacement. Any attached result also blocks correction.
- The destination Curriculum must contain exactly the eight active/current destination-grade baseline Offerings, each covering all configured Academic Terms and free of SHS context. A corrected successor with `replacesSubjectOfferingId` remains eligible when otherwise valid; an Offering with an active downstream replacement is ineligible.
- The Enrollment keeps its ID, Student, Academic Year, active lifecycle, entry facts, creation facts, and legacy Semester value while its Section and the Student summary move atomically.
- A zero-source correction creates the destination baseline without subject links. An eight-source correction records exact prefix-matched links, changes source Student Subject Enrollments only from `ACTIVE` to `REPLACED`, never uses `DROPPED`, preserves their old Terms, and creates eight new full-year `ACTIVE` destination rows.

## Evidence And Safety

- `StudentEnrollmentGradeCorrection` is an immutable parent event; `StudentParticipationCorrection` is a separate immutable child linking exact source and replacement participation with snapshots.
- The Service owns a `SERIALIZABLE` transaction with deterministic locking and bounded three-attempt serialization/deadlock retry.
- PostgreSQL requires a dedicated transaction-local GUC capability and sequence-backed advisory membership exact to the grade-correction event. This capability is separate from the Phase 21F-A placement-correction capability.
- Deferred database checks validate source cardinality and history, destination baseline and Terms, immutable snapshots and links, Section and Student synchronization, exact lifecycle transitions, audit-safe composition, and transaction completion.
- Generic regular-JHS replacement outside the exact command is blocked. The dormant generic reconciliation/replacement helper is retired; ordinary derivation remains creation-only.
- Each success atomically audits the parent correction, Enrollment update, source replacements, and destination creations.

## Application Surface

- Enrollment Details uses one permission-aware correction dialog and one unified immutable history surface for Phase 21F-A placement and Phase 21F-B grade corrections.
- Different-grade selection presents an eligibility preview, old and new baseline subjects and Terms, blockers, mandatory reason/evidence, and irreversible confirmation.
- Once the first Academic Term has started, the caller must also type the exact grade-change confirmation phrase.
- Old participation and Terms remain readable as history; no result, Grade, or historical identity is moved, rewritten, or deleted.

## Verification

- Focused Phase 21F-B and affected Phase 21F-A boundary: 54 passed, zero failed.
- Disposable-database concurrency boundary: two passed, zero failed; temporary databases were removed.
- Complete sequential repository suite: 346 passed, nine expected environment-gated skips, zero failed.
- Migrations `20260824014000_phase21f_b_jhs_grade_correction` and `20260824015000_phase21f_b_jhs_replacement_scope_hardening` are applied. The focused follow-up requires every Grade 7-10 `ACTIVE -> REPLACED` transition, including malformed legacy shapes, to use the exact Phase 21F-B capability while preserving SHS lifecycle behavior. Prisma validation and migration/schema drift checks pass with 48 applied migrations and no drift.
- `npx tsc --noEmit`, targeted ESLint, `npm run build`, and `git diff --check` pass.
- Protected hashes remain unchanged. Zero grade-correction, placement-correction, Curriculum-correction, fixture, or temporary-database rows remain after verification.
- Authenticated browser verification remains pending because no authenticated browser harness is available.

## Deferred Work

- Repeat grade correction after any historical replacement remains blocked unless separately designed.
- Specialized-program JHS, SHS, cross-program, cross-year, transferee-history, terminal-state, reopening, archive/restore, and Enrollment-history correction.
- JHS participation outside the exact baseline; SHS Core, elective, or Term-specific participation correction; and Student Subject Enrollment migration, reinstatement, or generic reconciliation.
- DRAFT result correction and FINALIZED result revision.
- Curriculum changes through student correction, policy revision/versioning, prerequisites, subject completion, transferred credits, progression, promotion, graduation, `TermEnrollment`, scheduling, attendance, and legacy Grade migration.
