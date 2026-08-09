"use server";

import * as z from "zod";

import { Permissions, requirePermission } from "@/lib/authorization";
import {
  AcademicYearTableQuerySchema,
  CreateAcademicYearSchema,
  UpdateAcademicYearSchema,
  type AcademicYearTableQueryInput,
  type CreateAcademicYearInput,
  type UpdateAcademicYearInput,
} from "@/schemas";
import {
  AcademicYearServiceError,
  activateAcademicYearService,
  archiveAcademicYearService,
  createAcademicYearService,
  getAcademicYearFilterOptions,
  getAcademicYears,
  lockAcademicYearService,
  updateAcademicYearService,
} from "@/services/academic-year.service";
import type { ActionResponse } from "@/types/action-response";

export async function getAcademicYearsAction(query: AcademicYearTableQueryInput) {
  await requirePermission(Permissions.ACADEMIC_YEARS);
  const validatedQuery = AcademicYearTableQuerySchema.safeParse(query);

  if (!validatedQuery.success) {
    throw new AcademicYearServiceError(
      "Invalid academic year query.",
      "INVALID_QUERY",
    );
  }

  return getAcademicYears(validatedQuery.data);
}

export async function getAcademicYearFilterOptionsAction() {
  await requirePermission(Permissions.ACADEMIC_YEARS);

  return getAcademicYearFilterOptions();
}

async function authorizeAction(): Promise<ActionResponse | undefined> {
  try {
    await requirePermission(Permissions.ACADEMIC_YEARS);
  } catch {
    return { error: "Unauthorized." };
  }
}

function mapActionError(error: unknown): ActionResponse {
  return error instanceof AcademicYearServiceError
    ? { error: error.message }
    : { error: "Something went wrong." };
}

export async function createAcademicYearAction(
  values: CreateAcademicYearInput,
): Promise<ActionResponse> {
  const unauthorized = await authorizeAction();

  if (unauthorized) return unauthorized;

  const validatedFields = CreateAcademicYearSchema.safeParse(values);

  if (!validatedFields.success) return { error: "Invalid fields." };

  try {
    await createAcademicYearService(validatedFields.data);
    return { success: "Academic year created successfully." };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function updateAcademicYearAction(
  id: string,
  values: UpdateAcademicYearInput,
): Promise<ActionResponse> {
  const unauthorized = await authorizeAction();

  if (unauthorized) return unauthorized;

  const validatedId = z.string().min(1).safeParse(id);
  const validatedFields = UpdateAcademicYearSchema.safeParse(values);

  if (!validatedId.success || !validatedFields.success) {
    return { error: "Invalid fields." };
  }

  try {
    await updateAcademicYearService(validatedId.data, validatedFields.data);
    return { success: "Academic year updated successfully." };
  } catch (error) {
    return mapActionError(error);
  }
}

async function runStatusAction(
  id: string,
  service: (academicYearId: string) => Promise<string>,
  success: string,
): Promise<ActionResponse> {
  const unauthorized = await authorizeAction();

  if (unauthorized) return unauthorized;

  const validatedId = z.string().min(1).safeParse(id);

  if (!validatedId.success) return { error: "Invalid academic year." };

  try {
    await service(validatedId.data);
    return { success };
  } catch (error) {
    return mapActionError(error);
  }
}

export async function activateAcademicYearAction(id: string) {
  return runStatusAction(
    id,
    activateAcademicYearService,
    "Academic year activated successfully.",
  );
}

export async function lockAcademicYearAction(id: string) {
  return runStatusAction(
    id,
    lockAcademicYearService,
    "Academic year locked successfully.",
  );
}

export async function archiveAcademicYearAction(id: string) {
  return runStatusAction(
    id,
    archiveAcademicYearService,
    "Academic year archived successfully.",
  );
}
