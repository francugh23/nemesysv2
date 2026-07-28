import { findSubjects } from "@/repositories/subject.repository";

export async function getSubjects() {
  return await findSubjects();
}
