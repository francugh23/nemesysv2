"use server";

import { getTeachers } from "@/services/teacher.service";

export async function getTeachersAction() {
  return await getTeachers();
}
