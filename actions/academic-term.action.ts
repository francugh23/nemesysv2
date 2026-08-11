"use server";

import * as z from "zod";

import { Permissions, requirePermission } from "@/lib/authorization";
import {
  CreateAcademicTermSchema,
  UpdateAcademicTermSchema,
  type CreateAcademicTermInput,
  type UpdateAcademicTermInput,
} from "@/schemas";
import {
  AcademicTermServiceError,
  createAcademicTermService,
  deleteAcademicTermService,
  getAcademicTerms,
  updateAcademicTermService,
} from "@/services/academic-term.service";
import type { ActionResponse } from "@/types/action-response";

export async function getAcademicTermsAction(academicYearId: string) {
  await requirePermission(Permissions.ACADEMIC_YEARS);
  const id = z.string().min(1).parse(academicYearId);
  return getAcademicTerms(id);
}

async function authorizeAction(): Promise<ActionResponse | undefined> {
  try {
    await requirePermission(Permissions.ACADEMIC_YEARS);
  } catch {
    return { error: "Unauthorized." };
  }
}

function mapError(error: unknown): ActionResponse {
  return error instanceof AcademicTermServiceError
    ? { error: error.message }
    : { error: "Something went wrong." };
}

export async function createAcademicTermAction(
  academicYearId: string,
  values: CreateAcademicTermInput,
): Promise<ActionResponse> {
  const unauthorized = await authorizeAction();
  const id = z.string().min(1).safeParse(academicYearId);
  const fields = CreateAcademicTermSchema.safeParse(values);

  if (unauthorized) return unauthorized;
  if (!id.success || !fields.success) return { error: "Invalid fields." };

  try {
    await createAcademicTermService(id.data, fields.data);
    return { success: "Academic term created successfully." };
  } catch (error) {
    return mapError(error);
  }
}

export async function updateAcademicTermAction(
  id: string,
  values: UpdateAcademicTermInput,
): Promise<ActionResponse> {
  const unauthorized = await authorizeAction();
  const termId = z.string().min(1).safeParse(id);
  const fields = UpdateAcademicTermSchema.safeParse(values);

  if (unauthorized) return unauthorized;
  if (!termId.success || !fields.success) return { error: "Invalid fields." };

  try {
    await updateAcademicTermService(termId.data, fields.data);
    return { success: "Academic term updated successfully." };
  } catch (error) {
    return mapError(error);
  }
}

export async function deleteAcademicTermAction(id: string): Promise<ActionResponse> {
  const unauthorized = await authorizeAction();
  const termId = z.string().min(1).safeParse(id);

  if (unauthorized) return unauthorized;
  if (!termId.success) return { error: "Invalid academic term." };

  try {
    await deleteAcademicTermService(termId.data);
    return { success: "Academic term removed successfully." };
  } catch (error) {
    return mapError(error);
  }
}
