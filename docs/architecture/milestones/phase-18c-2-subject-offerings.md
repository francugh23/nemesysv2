# Phase 18C-2: Subject Offering Foundation

Subject Offerings establish the year-specific curriculum layer without changing SubjectAssignment, Enrollment, Grade, or legacy Semester data. Each Offering references a reusable Subject and Academic Year, snapshots its code and description, supports soft archive, and explicitly links applicable Academic Terms.

JHS Grade 7-10 Offering writes require all three Terms of the selected ACTIVE Academic Year. SHS curriculum, Academic/TechPro context, electives, Student Subject Enrollment, grading, Scheduling, and Assignment redesign are deferred. The migration creates no Offering rows and does not infer curriculum data from existing records.

Offering management uses `Permissions.SUBJECTS`, transactional audit records, the standard component-to-hook-to-Action-to-service-to-repository flow, and a URL-driven table at `/dashboard/subject-offerings`.
