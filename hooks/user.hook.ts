"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  createUserAction,
  changeUserRoleAction,
  changeUserStatusAction,
  getUserFilterOptionsAction,
  getUsersAction,
  updateUserAction,
  resetUserPasswordAction,
} from "@/actions/user.action";
import type { UserTableQueryInput } from "@/schemas";
import type { ActionResponse } from "@/types/action-response";

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

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string;
      values: Parameters<typeof updateUserAction>[1];
    }) => updateUserAction(id, values),
    onSuccess: async (result) => {
      if (!result.error) {
        await queryClient.invalidateQueries({ queryKey: ["users"] });
      }
    },
  });
}

function useUserAdministrationMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<ActionResponse>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: async (result) => {
      if (!result.error) {
        await queryClient.invalidateQueries({ queryKey: ["users"] });
      }
    },
  });
}

export function useResetUserPassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: resetUserPasswordAction,
    gcTime: 0,
    onSuccess: async (result) => {
      if (!result.error) {
        await queryClient.invalidateQueries({ queryKey: ["users"] });
      }
    },
  });
}

export function useChangeUserStatus() {
  return useUserAdministrationMutation(
    ({ id, status }: { id: string; status: "ACTIVE" | "INACTIVE" }) =>
      changeUserStatusAction(id, status),
  );
}

export function useChangeUserRole() {
  return useUserAdministrationMutation(
    ({ id, role }: { id: string; role: "SUPER_ADMIN" | "REGISTRAR" | "PRINCIPAL" }) =>
      changeUserRoleAction(id, role),
  );
}
