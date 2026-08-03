"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  createUserAction,
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

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createUserAction,
    gcTime: 0,
    onSuccess: async (result) => {
      if (!result.error) {
        await queryClient.invalidateQueries({ queryKey: ["users"] });
      }
    },
  });
}
