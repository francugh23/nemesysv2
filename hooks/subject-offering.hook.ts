"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { archiveSubjectOfferingAction, createSubjectOfferingAction, getSubjectOfferingOptionsAction, getSubjectOfferingsAction, updateSubjectOfferingAction } from "@/actions/subject-offering.action";
export function useSubjectOfferings(query:Parameters<typeof getSubjectOfferingsAction>[0]){return useQuery({queryKey:["subject-offerings",query],queryFn:()=>getSubjectOfferingsAction(query),placeholderData:keepPreviousData});}
export function useSubjectOfferingOptions(){return useQuery({queryKey:["subject-offering-options"],queryFn:getSubjectOfferingOptionsAction});}
function useInvalidate(){const qc=useQueryClient();return()=>Promise.all([qc.invalidateQueries({queryKey:["subject-offerings"]}),qc.invalidateQueries({queryKey:["subject-offering-options"]})]);}
export function useCreateSubjectOffering(){const invalidate=useInvalidate();return useMutation({mutationFn:createSubjectOfferingAction,onSuccess:async r=>{if(!r.error)await invalidate();}});}
export function useUpdateSubjectOffering(){const invalidate=useInvalidate();return useMutation({mutationFn:({id,values}:{id:string;values:unknown})=>updateSubjectOfferingAction(id,values),onSuccess:async r=>{if(!r.error)await invalidate();}});}
export function useArchiveSubjectOffering(){const invalidate=useInvalidate();return useMutation({mutationFn:archiveSubjectOfferingAction,onSuccess:async r=>{if(!r.error)await invalidate();}});}
