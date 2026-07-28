"use server";

import { getSubjects } from "@/services/subject.service";

export async function getSubjectsAction() {
  return await getSubjects();
}
