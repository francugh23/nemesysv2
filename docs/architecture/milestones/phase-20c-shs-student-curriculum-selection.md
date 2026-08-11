# Phase 20C: SSHS Student Curriculum Selection

Phase 20C adds controlled school approval and explicit Enrollment-scoped SSHS selection. It does not assert that any DepEd candidate is available at NVGCHS.

## Approval Boundary

- Only an active `PROVISIONAL_DEPED` Grade 11 or 12 Offering can be promoted through the dedicated approval operation.
- Promotion requires a nonblank school approval reference and records `approvedById` and `approvedAt` with a transactional audit record.
- `ShsCurriculumReference` remains a provisional DepEd source record. Its source reference is preserved on the approved Offering context.
- Generic Offering creation and updates are provisional-only. School-approved Offerings cannot be revised through that workflow, preserving existing Student Subject Enrollment snapshots.
- `SHS_CURRICULUM_APPROVAL` is available only to Super Admin and Registrar. Registrar does not receive `SUBJECTS`.

## Student Selection Boundary

- `Permissions.ENROLLMENT` permits Super Admin and Registrar to select active `SCHOOL_APPROVED` Grade 11/12 Offerings for an active Enrollment.
- Eligibility is strictly the Enrollment Academic Year, Section grade, non-archived Offering, and school-approved SSHS context. `trackStrand` is not read for curriculum inference.
- The submitted desired selection is transactional: retained active rows remain active, deselected SSHS rows become `REPLACED`, and new rows snapshot Offering identity, SSHS context, and exact Offering Terms. Every replacement and creation is audited.
- Provisional Offerings remain database-blocked from Student Subject Enrollment materialization. Grade 12 source candidates remain within the Phase 20B pilot boundary until explicitly approved; approval does not claim NVGCHS pilot participation.

## Deferred

Academic Setup consolidation, automatic SSHS derivation, strand/program inference, prerequisites, progression, teacher assignment, scheduling, grading, assessments, equivalency, irregular student rules, and semestral calendar work remain deferred.
