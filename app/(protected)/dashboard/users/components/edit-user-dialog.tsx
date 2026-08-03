"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { FormDialog } from "@/components/common/dialogs/form-dialog";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateUser } from "@/hooks/user.hook";
import {
  UpdateUserSchema,
  type UpdateUserInput,
  type UserListItem,
} from "@/schemas";

interface EditUserDialogProps {
  user: UserListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditUserDialog({
  user,
  open,
  onOpenChange,
}: EditUserDialogProps) {
  const updateUser = useUpdateUser();
  const form = useForm<UpdateUserInput>({
    resolver: zodResolver(UpdateUserSchema),
    defaultValues: {
      firstName: user.firstName,
      middleName: user.middleName ?? "",
      lastName: user.lastName,
      employeeNumber: user.employeeNumber ?? "",
      username: user.username,
      email: user.email,
      gender: user.gender,
    },
  });

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && updateUser.isPending) {
      return;
    }

    onOpenChange(nextOpen);
  }

  async function onSubmit(values: UpdateUserInput) {
    try {
      const result = await updateUser.mutateAsync({ id: user.id, values });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.success);
      onOpenChange(false);
    } catch {
      toast.error("Unable to update the user. Try again.");
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Edit User"
      maxWidth="max-w-2xl!"
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">
            Account Information
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field data-invalid={!!form.formState.errors.employeeNumber}>
              <FieldLabel htmlFor="edit-user-employee-number">
                Employee Number
              </FieldLabel>
              <Input
                id="edit-user-employee-number"
                aria-invalid={!!form.formState.errors.employeeNumber}
                aria-describedby={
                  form.formState.errors.employeeNumber
                    ? "edit-user-employee-number-error"
                    : undefined
                }
                {...form.register("employeeNumber")}
              />
              <FieldError id="edit-user-employee-number-error">
                {form.formState.errors.employeeNumber?.message}
              </FieldError>
            </Field>

            <Field data-invalid={!!form.formState.errors.username}>
              <FieldLabel htmlFor="edit-user-username">Username</FieldLabel>
              <Input
                id="edit-user-username"
                aria-invalid={!!form.formState.errors.username}
                aria-describedby={
                  form.formState.errors.username
                    ? "edit-user-username-error"
                    : undefined
                }
                {...form.register("username")}
              />
              <FieldError id="edit-user-username-error">
                {form.formState.errors.username?.message}
              </FieldError>
            </Field>

            <Field data-invalid={!!form.formState.errors.email}>
              <FieldLabel htmlFor="edit-user-email">Email</FieldLabel>
              <Input
                id="edit-user-email"
                type="email"
                aria-invalid={!!form.formState.errors.email}
                aria-describedby={
                  form.formState.errors.email
                    ? "edit-user-email-error"
                    : undefined
                }
                {...form.register("email")}
              />
              <FieldError id="edit-user-email-error">
                {form.formState.errors.email?.message}
              </FieldError>
            </Field>

          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">
            Personal Information
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field data-invalid={!!form.formState.errors.firstName}>
              <FieldLabel htmlFor="edit-user-first-name">
                First Name
              </FieldLabel>
              <Input
                id="edit-user-first-name"
                aria-invalid={!!form.formState.errors.firstName}
                aria-describedby={
                  form.formState.errors.firstName
                    ? "edit-user-first-name-error"
                    : undefined
                }
                {...form.register("firstName")}
              />
              <FieldError id="edit-user-first-name-error">
                {form.formState.errors.firstName?.message}
              </FieldError>
            </Field>

            <Field data-invalid={!!form.formState.errors.middleName}>
              <FieldLabel htmlFor="edit-user-middle-name">
                Middle Name
              </FieldLabel>
              <Input
                id="edit-user-middle-name"
                aria-invalid={!!form.formState.errors.middleName}
                aria-describedby={
                  form.formState.errors.middleName
                    ? "edit-user-middle-name-error"
                    : undefined
                }
                {...form.register("middleName")}
              />
              <FieldError id="edit-user-middle-name-error">
                {form.formState.errors.middleName?.message}
              </FieldError>
            </Field>

            <Field data-invalid={!!form.formState.errors.lastName}>
              <FieldLabel htmlFor="edit-user-last-name">Last Name</FieldLabel>
              <Input
                id="edit-user-last-name"
                aria-invalid={!!form.formState.errors.lastName}
                aria-describedby={
                  form.formState.errors.lastName
                    ? "edit-user-last-name-error"
                    : undefined
                }
                {...form.register("lastName")}
              />
              <FieldError id="edit-user-last-name-error">
                {form.formState.errors.lastName?.message}
              </FieldError>
            </Field>

            <Field data-invalid={!!form.formState.errors.gender}>
              <FieldLabel htmlFor="edit-user-gender">Gender</FieldLabel>
              <Controller
                name="gender"
                control={form.control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id="edit-user-gender"
                      ref={field.ref}
                      onBlur={field.onBlur}
                      aria-invalid={!!form.formState.errors.gender}
                      aria-describedby={
                        form.formState.errors.gender
                          ? "edit-user-gender-error"
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
              <FieldError id="edit-user-gender-error">
                {form.formState.errors.gender?.message}
              </FieldError>
            </Field>
          </div>
        </section>

        <Button
          type="submit"
          disabled={updateUser.isPending || !form.formState.isDirty}
        >
          {updateUser.isPending ? "Saving..." : "Update User"}
        </Button>
      </form>
    </FormDialog>
  );
}
