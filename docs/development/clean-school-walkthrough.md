# Clean-School Walkthrough Database

## Purpose

The development-only walkthrough workflow creates a fresh database from the protected `nemesysv2_walkthrough_template`. It never deletes rows from the populated `nemesysv2` source database and never disables database guards, foreign keys, or triggers.

## Baseline

The template preserves six existing accounts, three Teacher profiles, 32 reusable JHS Subjects, 171 source-backed SHS Subjects, 16 SHS clusters, 171 SHS references, and the complete Prisma schema/migration history.

It starts at zero for Academic Years, Terms, Sections, Students, Subject Assignments, Offerings, Offering Terms, SHS contexts, policies, Curriculum finalization/correction, Enrollment, participation, results/revisions, Grades, correction records, and audit logs. Custom SHS test definitions not backed by `ShsCurriculumReference`, including `ENG11`, are excluded.

## Safety

`npm run walkthrough:database` refuses unless all of the following hold:

- `NODE_ENV=development`
- `NEMESYS_RESET_CONFIRM=CREATE_WALKTHROUGH_DATABASE`
- `DATABASE_URL` names the protected local source database `nemesysv2`
- the target is a lowercase database name beginning with `nemesysv2_walkthrough_`
- source schema and successful Prisma migration identity are recognized

Dry-run is the default. `--apply` is required to create a target. `--refresh-template` additionally recreates the protected template from the source schema and approved baseline records. Existing targets require the separate `--replace-target` flag.

The tool uses a schema-only PostgreSQL dump into a new database and copies only approved baseline records. It does not use `TRUNCATE CASCADE`, `DROP SCHEMA`, migration-history edits, or generic trigger/FK disabling.

## Commands

```powershell
$env:NODE_ENV = "development"
$env:NEMESYS_RESET_CONFIRM = "CREATE_WALKTHROUGH_DATABASE"
npm run walkthrough:database -- --target nemesysv2_walkthrough_<name>
```

Create or refresh the template and create a new target:

```powershell
npm run walkthrough:database -- --target nemesysv2_walkthrough_<name> --apply --refresh-template
```

Replace only an existing prefixed target:

```powershell
npm run walkthrough:database -- --target nemesysv2_walkthrough_<name> --apply --replace-target
```

## Walkthrough Sequence

1. Create an Academic Year as DRAFT.
2. Configure three ordered, non-overlapping Terms.
3. Optionally adopt prior Curriculum while the destination remains DRAFT.
4. Activate the Academic Year.
5. Build JHS Curriculum.
6. Build SHS Curriculum.
7. Configure SHS classifications, clusters, elective policies, and approval/provenance.
8. Create Sections.
9. Enroll test students.
10. Verify JHS derivation.
11. Verify SHS progression and elective selection.
12. Test placement, JHS grade, and SHS participation corrections separately.
13. Enter, finalize, and revise SHS results.
14. Finalize Curriculum when ordinary configuration is intentionally complete.
15. Test controlled Curriculum correction during an inter-Term gap.
16. Verify history and audit behavior.
17. Lock and later archive the Academic Year when operations are complete.

Terms and adoption are DRAFT-only. Ordinary Subject Offering configuration is ACTIVE-only. Curriculum finalization is separate from Academic Year LOCKED/ARCHIVED and does not close Enrollment or result operations.

## Limitation

The current migration chain cannot independently create a usable empty database. This workflow therefore creates targets from the versioned template rather than using `prisma migrate reset`. A blank-SHS bootstrap is deliberately out of scope.
