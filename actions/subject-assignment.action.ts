"use server";

import { getSubjectAssignments } from "@/services/subject-assignment.service";

export async function getSubjectAssignmentsAction() {
  return await getSubjectAssignments();
}
