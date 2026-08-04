"use client";

import { useMutation } from "@tanstack/react-query";

import { changeOwnPasswordAction } from "@/actions/account.action";

export function useChangeOwnPassword() {
  return useMutation({
    mutationFn: changeOwnPasswordAction,
  });
}
