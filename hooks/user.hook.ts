"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
  getUserFilterOptionsAction,
  getUsersAction,
} from "@/actions/user.action";
import type { UserTableQueryInput } from "@/schemas";

export function useUsers(query: UserTableQueryInput) {
  return useQuery({
    queryKey: ["users", query],
    queryFn: () => getUsersAction(query),
    placeholderData: keepPreviousData,
  });
}

export function useUserFilterOptions() {
  return useQuery({
    queryKey: ["users", "filter-options"],
    queryFn: getUserFilterOptionsAction,
  });
}
