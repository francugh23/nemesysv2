"use server";

import * as z from "zod";

import { Permissions, requirePermission } from "@/lib/authorization";
import {
  CreateShsCurriculumClusterSchema,
  CreateSubjectOfferingSchema,
  CorrectSubjectOfferingSchema,
  SubjectOfferingTableQuerySchema,
  UpdateShsCurriculumClusterSchema,
  UpdateSubjectOfferingSchema,
  PromoteShsSubjectOfferingSchema,
  type SubjectOfferingTableQueryInput,
} from "@/schemas";
import {
  correctSubjectOfferingService,
  CurriculumCorrectionServiceError,
  getCurriculumCorrectionContext,
  getCurriculumCorrectionDetail,
} from "@/services/curriculum-correction.service";
import {
  archiveShsCurriculumClusterService,
  archiveSubjectOfferingService,
  createShsCurriculumClusterService,
  createSubjectOfferingService,
  getShsCurriculumClusters,
  getSubjectOfferingOptions,
  getSubjectOfferingFilterOptions,
  getSubjectOfferings,
  updateShsCurriculumClusterService,
  updateSubjectOfferingService,
  promoteShsSubjectOfferingService,
} from "@/services/subject-offering.service";

async function auth() { try { await requirePermission(Permissions.SUBJECTS); return null; } catch { return { error: "Unauthorized." }; } }
async function run(fn: () => Promise<unknown>, success: string) { try { await fn(); return { success }; } catch (error) { return { error: error instanceof Error ? error.message : "Something went wrong." }; } }

export async function getSubjectOfferingsAction(query: SubjectOfferingTableQueryInput) { await requirePermission(Permissions.SHS_CURRICULUM_APPROVAL); return getSubjectOfferings(SubjectOfferingTableQuerySchema.parse(query)); }
export async function getSubjectOfferingOptionsAction() { await requirePermission(Permissions.SHS_CURRICULUM_APPROVAL); return getSubjectOfferingOptions(); }
export async function getSubjectOfferingFilterOptionsAction() { await requirePermission(Permissions.SHS_CURRICULUM_APPROVAL); return getSubjectOfferingFilterOptions(); }
export async function getShsCurriculumClustersAction() { await requirePermission(Permissions.SHS_CURRICULUM_APPROVAL); return getShsCurriculumClusters(); }
export async function getCurriculumCorrectionContextAction(sourceOfferingId: string) {
  await requirePermission(Permissions.SUBJECTS);
  const parsed = z.string().min(1).safeParse(sourceOfferingId);
  if (!parsed.success) throw new CurriculumCorrectionServiceError("Invalid Subject Offering.");
  return getCurriculumCorrectionContext(parsed.data);
}
export async function getCurriculumCorrectionDetailAction(subjectOfferingId: string) {
  await requirePermission(Permissions.SUBJECTS);
  const parsed = z.string().min(1).safeParse(subjectOfferingId);
  if (!parsed.success) throw new CurriculumCorrectionServiceError("Invalid Subject Offering.");
  return getCurriculumCorrectionDetail(parsed.data);
}
export async function createSubjectOfferingAction(values: unknown) { const authorized = await auth(); if (authorized) return authorized; const parsed = CreateSubjectOfferingSchema.safeParse(values); return parsed.success ? run(() => createSubjectOfferingService(parsed.data), "Subject offering saved successfully.") : { error: "Invalid fields." }; }
export async function updateSubjectOfferingAction(id: string, values: unknown) { const authorized = await auth(); if (authorized) return authorized; const parsed = UpdateSubjectOfferingSchema.safeParse(values); return z.string().min(1).safeParse(id).success && parsed.success ? run(() => updateSubjectOfferingService(id, parsed.data), "Subject offering saved successfully.") : { error: "Invalid fields." }; }
export async function archiveSubjectOfferingAction(id: string) { const authorized = await auth(); if (authorized) return authorized; return z.string().min(1).safeParse(id).success ? run(() => archiveSubjectOfferingService(id), "Subject offering archived successfully.") : { error: "Invalid subject offering." }; }
export async function promoteShsSubjectOfferingAction(values: unknown) { try { await requirePermission(Permissions.SHS_CURRICULUM_APPROVAL); } catch { return { error: "Unauthorized." }; } const parsed = PromoteShsSubjectOfferingSchema.safeParse(values); return parsed.success ? run(() => promoteShsSubjectOfferingService(parsed.data), "SHS subject offering approved successfully.") : { error: "Invalid fields." }; }
export async function correctSubjectOfferingAction(values: unknown) {
  const authorized = await auth();
  if (authorized) return authorized;
  const parsed = CorrectSubjectOfferingSchema.safeParse(values);
  if (!parsed.success) return { error: "Invalid correction fields." };
  try {
    await correctSubjectOfferingService(parsed.data);
    return { success: "Curriculum Offering replaced successfully." };
  } catch (error) {
    return { error: error instanceof CurriculumCorrectionServiceError ? error.message : "Controlled Curriculum correction could not be completed." };
  }
}

export async function createShsCurriculumClusterAction(values: unknown) { const authorized = await auth(); if (authorized) return authorized; const parsed = CreateShsCurriculumClusterSchema.safeParse(values); return parsed.success ? run(() => createShsCurriculumClusterService(parsed.data), "SHS curriculum cluster saved successfully.") : { error: "Invalid fields." }; }
export async function updateShsCurriculumClusterAction(id: string, values: unknown) { const authorized = await auth(); if (authorized) return authorized; const parsed = UpdateShsCurriculumClusterSchema.safeParse(values); return z.string().min(1).safeParse(id).success && parsed.success ? run(() => updateShsCurriculumClusterService(id, parsed.data), "SHS curriculum cluster saved successfully.") : { error: "Invalid fields." }; }
export async function archiveShsCurriculumClusterAction(id: string) { const authorized = await auth(); if (authorized) return authorized; return z.string().min(1).safeParse(id).success ? run(() => archiveShsCurriculumClusterService(id), "SHS curriculum cluster archived successfully.") : { error: "Invalid SHS curriculum cluster." }; }
