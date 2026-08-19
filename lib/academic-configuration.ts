export const ACADEMIC_CONFIGURATION_HIERARCHY = [
  "Academic Years",
  "Subjects",
  "Curriculum",
] as const;

export const ACADEMIC_CONFIGURATION_LINKS = [
  { title: "Academic Years", href: "/dashboard/academic-years" },
  { title: "Subjects", href: "/dashboard/subjects" },
  { title: "Curriculum", href: "/dashboard/subject-offerings" },
] as const;

export const CURRICULUM_ROUTE = "/dashboard/subject-offerings";
export const CURRICULUM_TITLE = "Curriculum";
export const CURRICULUM_DESCRIPTION =
  "Curriculum is Academic-Year-specific. Each Subject Offering connects a reusable Subject definition to an Academic Year, grade level, and applicable Academic Terms.";
export const SUBJECTS_DESCRIPTION =
  "A Subject is a reusable academic definition. Creating one does not add it to an Academic Year, make it part of Curriculum, or enroll students.";
