import { findTeachers } from "@/repositories/teacher.repository";

export async function getTeachers() {
  return await findTeachers();
}
