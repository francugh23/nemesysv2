"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, CirclePlus, Copy } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { FormDialog } from "@/components/common/dialogs/form-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateUser } from "@/hooks/user.hook";
import { CreateUserSchema, type CreateUserInput } from "@/schemas";

interface CreatedCredentials {
  username: string;
  temporaryPassword: string;
}

const defaultValues: CreateUserInput = {
  employeeNumber: "",
  username: "",
  email: "",
  firstName: "",
  middleName: "",
  lastName: "",
  gender: "MALE",
  role: "REGISTRAR",
};

export function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const [credentials, setCredentials] = useState<CreatedCredentials | null>(
    null,
  );
  const createUser = useCreateUser();
  const form = useForm<CreateUserInput>({
    resolver: zodResolver(CreateUserSchema),
    defaultValues,
  });

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && createUser.isPending) {
      return;
    }

    setOpen(nextOpen);

    if (!nextOpen) {
      setCredentials(null);
      form.reset();
    }
  }

  async function onSubmit(values: CreateUserInput) {
    try {
      const result = await createUser.mutateAsync(values);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (!result.temporaryPassword) {
        toast.error("The temporary password could not be displayed.");
        return;
      }

      setCredentials({
        username: values.username,
        temporaryPassword: result.temporaryPassword,
      });
      createUser.reset();
      form.reset();
      toast.success(result.success);
    } catch {
      toast.error("Unable to create the user. Try again.");
    }
  }

  async function copyPassword() {
    if (!credentials) {
      return;
    }

    try {
      await navigator.clipboard.writeText(credentials.temporaryPassword);
      toast.success("Temporary password copied.");
    } catch {
      toast.error("Unable to copy the temporary password.");
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <CirclePlus />
        Add User
      </Button>
      <FormDialog
        open={open}
        onOpenChange={handleOpenChange}
        title={credentials ? "User Created" : "Create User"}
        maxWidth="max-w-2xl!"
      >
        {credentials ? (
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <Check className="mt-0.5 size-5 shrink-0 text-primary" />
              <div className="space-y-1">
                <p className="font-medium">Account created successfully</p>
                <p className="text-sm text-muted-foreground">
                  Share this temporary password securely. It will not be shown
                  again after this dialog is closed.
                </p>
              </div>
            </div>

            <Field>
              <FieldLabel htmlFor="created-username">Username</FieldLabel>
              <Input
                id="created-username"
                value={credentials.username}
                readOnly
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="created-temporary-password">
                Temporary Password
              </FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="created-temporary-password"
                  value={credentials.temporaryPassword}
                  readOnly
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void copyPassword()}
                  aria-label="Copy temporary password"
                >
                  <Copy />
                </Button>
              </div>
            </Field>

            <Button type="button" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase text-muted-foreground">
                Account Information
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="create-user-employee-number">
                    Employee Number
                  </FieldLabel>
                  <Input
                    id="create-user-employee-number"
                    aria-invalid={!!form.formState.errors.employeeNumber}
                    aria-describedby={
                      form.formState.errors.employeeNumber
                        ? "create-user-employee-number-error"
                        : undefined
                    }
                    {...form.register("employeeNumber")}
                  />
                  <FieldError id="create-user-employee-number-error">
                    {form.formState.errors.employeeNumber?.message}
                  </FieldError>
                </Field>
                <Field>
                  <FieldLabel htmlFor="create-user-username">
                    Username
                  </FieldLabel>
                  <Input
                    id="create-user-username"
                    aria-invalid={!!form.formState.errors.username}
                    aria-describedby={
                      form.formState.errors.username
                        ? "create-user-username-error"
                        : undefined
                    }
                    {...form.register("username")}
                  />
                  <FieldError id="create-user-username-error">
                    {form.formState.errors.username?.message}
                  </FieldError>
                </Field>
                <Field>
                  <FieldLabel htmlFor="create-user-email">Email</FieldLabel>
                  <Input
                    id="create-user-email"
                    type="email"
                    aria-invalid={!!form.formState.errors.email}
                    aria-describedby={
                      form.formState.errors.email
                        ? "create-user-email-error"
                        : undefined
                    }
                    {...form.register("email")}
                  />
                  <FieldError id="create-user-email-error">
                    {form.formState.errors.email?.message}
                  </FieldError>
                </Field>
                <Field>
                  <FieldLabel htmlFor="create-user-role">Role</FieldLabel>
                  <Controller
                    name="role"
                    control={form.control}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger
                          id="create-user-role"
                          ref={field.ref}
                          onBlur={field.onBlur}
                          aria-invalid={!!form.formState.errors.role}
                          aria-describedby={
                            form.formState.errors.role
                              ? "create-user-role-error"
                              : undefined
                          }
                        >
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SUPER_ADMIN">
                            Super Admin
                          </SelectItem>
                          <SelectItem value="REGISTRAR">Registrar</SelectItem>
                          <SelectItem value="PRINCIPAL">Principal</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldError id="create-user-role-error">
                    {form.formState.errors.role?.message}
                  </FieldError>
                </Field>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase text-muted-foreground">
                Personal Information
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="create-user-first-name">
                    First Name
                  </FieldLabel>
                  <Input
                    id="create-user-first-name"
                    aria-invalid={!!form.formState.errors.firstName}
                    aria-describedby={
                      form.formState.errors.firstName
                        ? "create-user-first-name-error"
                        : undefined
                    }
                    {...form.register("firstName")}
                  />
                  <FieldError id="create-user-first-name-error">
                    {form.formState.errors.firstName?.message}
                  </FieldError>
                </Field>
                <Field>
                  <FieldLabel htmlFor="create-user-middle-name">
                    Middle Name
                  </FieldLabel>
                  <Input
                    id="create-user-middle-name"
                    aria-invalid={!!form.formState.errors.middleName}
                    aria-describedby={
                      form.formState.errors.middleName
                        ? "create-user-middle-name-error"
                        : undefined
                    }
                    {...form.register("middleName")}
                  />
                  <FieldError id="create-user-middle-name-error">
                    {form.formState.errors.middleName?.message}
                  </FieldError>
                </Field>
                <Field>
                  <FieldLabel htmlFor="create-user-last-name">
                    Last Name
                  </FieldLabel>
                  <Input
                    id="create-user-last-name"
                    aria-invalid={!!form.formState.errors.lastName}
                    aria-describedby={
                      form.formState.errors.lastName
                        ? "create-user-last-name-error"
                        : undefined
                    }
                    {...form.register("lastName")}
                  />
                  <FieldError id="create-user-last-name-error">
                    {form.formState.errors.lastName?.message}
                  </FieldError>
                </Field>
                <Field>
                  <FieldLabel htmlFor="create-user-gender">Gender</FieldLabel>
                  <Controller
                    name="gender"
                    control={form.control}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger
                          id="create-user-gender"
                          ref={field.ref}
                          onBlur={field.onBlur}
                          aria-invalid={!!form.formState.errors.gender}
                          aria-describedby={
                            form.formState.errors.gender
                              ? "create-user-gender-error"
                              : undefined
                          }
                        >
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MALE">Male</SelectItem>
                          <SelectItem value="FEMALE">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldError id="create-user-gender-error">
                    {form.formState.errors.gender?.message}
                  </FieldError>
                </Field>
              </div>
            </section>

            <Button type="submit" disabled={createUser.isPending}>
              {createUser.isPending ? "Creating..." : "Create User"}
            </Button>
          </form>
        )}
      </FormDialog>
    </>
  );
}
