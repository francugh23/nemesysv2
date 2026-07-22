"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";

import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { LoginSchema } from "@/schemas";
import { login } from "@/actions/login";
import { CardWrapper } from "./card-wrapper";

export function LoginForm() {
  const [error, setError] = useState<string | undefined>();

  const [isPending, startTransition] = useTransition();

  const form = useForm<z.infer<typeof LoginSchema>>({
    resolver: zodResolver(LoginSchema),

    defaultValues: {
      username: "",
      password: "",
    },
  });

  function onSubmit(values: z.infer<typeof LoginSchema>) {
    setError(undefined);

    startTransition(async () => {
      const result = await login(values);

      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <CardWrapper
      backButtonLabel="Don't have an account?"
      backButtonHref="/auth/register"
      showSocial
      headerLabel={""}
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="username" className="font-semibold">
              Username
            </FieldLabel>

            <Input
              id="username"
              placeholder="admin"
              disabled={isPending}
              {...form.register("username")}
              className=" font-semibold"
            />

            <FieldError>{form.formState.errors.username?.message}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="password" className=" font-semibold">
              Password
            </FieldLabel>

            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              disabled={isPending}
              {...form.register("password")}
              className="font-semibold"
            />

            <FieldError>{form.formState.errors.password?.message}</FieldError>
          </Field>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Logging in..." : "Login"}
          </Button>
        </FieldGroup>
      </form>
    </CardWrapper>
  );
}
