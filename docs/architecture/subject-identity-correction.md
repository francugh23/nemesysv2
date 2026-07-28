# Subject Identity Correction

## Active Subject Identity

An active Subject is uniquely identified by normalized `code`, `gradeLevel`, and `trackStrand`.

- Codes are trimmed and stored uppercase.
- Grade levels are stored as `7` through `12`.
- Track/strand values are trimmed and stored uppercase.
- Blank and null track/strand values are equivalent.
- Grades 7 through 10 cannot have a track/strand.
- Grades 11 and 12 may omit a track/strand for shared/core Subjects or provide one for strand-specific Subjects.

The migration-managed PostgreSQL expression index applies only to active Subjects. Soft-archived records remain historical and do not block a canonical active Subject.

## Preflight Query

Run this query before applying the migration. Every returned group requires review.

```sql
SELECT
  UPPER(BTRIM("code")) AS normalized_code,
  CASE UPPER(BTRIM("gradeLevel"))
    WHEN 'GRADE 7' THEN '7'
    WHEN 'GRADE 8' THEN '8'
    WHEN 'GRADE 9' THEN '9'
    WHEN 'GRADE 10' THEN '10'
    WHEN 'GRADE 11' THEN '11'
    WHEN 'GRADE 12' THEN '12'
    ELSE BTRIM("gradeLevel")
  END AS normalized_grade_level,
  COALESCE(NULLIF(UPPER(BTRIM("trackStrand")), ''), '') AS normalized_track_strand,
  ARRAY_AGG("id" ORDER BY "createdAt") AS subject_ids,
  COUNT(*) AS subject_count
FROM "Subject"
WHERE "deletedAt" IS NULL
GROUP BY 1, 2, 3
HAVING COUNT(*) > 1;
```

## Cleanup Procedure

1. Select the canonical Subject for each duplicate identity.
2. Repoint related `SubjectAssignment` and `Grade` records to the canonical Subject in a transaction.
3. Resolve any resulting SubjectAssignment or Grade unique-key conflicts before committing the reassignment.
4. Soft-archive the redundant Subject by setting `deletedAt`; retain its code and metadata to preserve audit history.
5. Hard-delete a redundant Subject only when it is confirmed accidental or test data and has no dependencies.
6. Record the canonical-to-redundant Subject mapping in the migration change record.

## Prisma Limitation

Prisma cannot express this PostgreSQL expression index in `schema.prisma`. The index is maintained by the SQL migration, and Subject identity lookups must use `findFirst` with normalized values rather than `findUnique`.

## Future Subject Assignment

Subject Assignment remains out of scope. Its future validation must require matching Section grade level and, for strand-specific Subjects, matching track/strand. Shared Subjects without a track/strand remain eligible for applicable SHS Sections.
