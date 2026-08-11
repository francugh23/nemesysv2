"use server";
import * as z from "zod";
import { Permissions, requirePermission } from "@/lib/authorization";
import { CreateSubjectOfferingSchema, SubjectOfferingTableQuerySchema, UpdateSubjectOfferingSchema, type SubjectOfferingTableQueryInput } from "@/schemas";
import { archiveSubjectOfferingService, createSubjectOfferingService, getSubjectOfferingOptions, getSubjectOfferings, updateSubjectOfferingService } from "@/services/subject-offering.service";
async function auth(){try{await requirePermission(Permissions.SUBJECTS);return null;}catch{return {error:"Unauthorized."};}}
export async function getSubjectOfferingsAction(q:SubjectOfferingTableQueryInput){await requirePermission(Permissions.SUBJECTS);return getSubjectOfferings(SubjectOfferingTableQuerySchema.parse(q));}
export async function getSubjectOfferingOptionsAction(){await requirePermission(Permissions.SUBJECTS);return getSubjectOfferingOptions();}
async function run(fn:()=>Promise<unknown>){try{await fn();return {success:"Subject offering saved successfully."};}catch(e){return {error:e instanceof Error?e.message:"Something went wrong."};}}
export async function createSubjectOfferingAction(v:unknown){const a=await auth();if(a)return a;const p=CreateSubjectOfferingSchema.safeParse(v);return p.success?run(()=>createSubjectOfferingService(p.data)):{error:"Invalid fields."};}
export async function updateSubjectOfferingAction(id:string,v:unknown){const a=await auth();const p=UpdateSubjectOfferingSchema.safeParse(v);if(a)return a;if(!z.string().min(1).safeParse(id).success||!p.success)return {error:"Invalid fields."};return run(()=>updateSubjectOfferingService(id,p.data));}
export async function archiveSubjectOfferingAction(id:string){const a=await auth();if(a)return a;if(!z.string().min(1).safeParse(id).success)return {error:"Invalid subject offering."};return run(()=>archiveSubjectOfferingService(id));}
