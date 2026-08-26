"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { AcademicTermBadge } from "@/components/common/badges";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAcademicTerms } from "@/hooks/academic-term.hook";
import {
  type ShsElectiveEnrollmentPolicy,
  useCreateShsElectiveEnrollmentPolicy,
  useShsElectiveEnrollmentPolicies,
  useUpdateShsElectiveEnrollmentPolicy,
} from "@/hooks/shs-elective-enrollment-policy.hook";
import type { AcademicTermListItem } from "@/schemas";

const GRADES = ["11", "12"] as const;
const ELECTIVE_COUNTS = [0, 1, 2, 3] as const;

export function ShsElectiveEnrollmentPolicyManager({
  academicYearId,
  open,
  readOnly,
}: {
  academicYearId: string;
  open: boolean;
  readOnly: boolean;
}) {
  const { data: terms, isLoading: termsLoading } =
    useAcademicTerms(academicYearId, open);
  const {
    data: policies,
    error,
    isLoading: policiesLoading,
  } = useShsElectiveEnrollmentPolicies(academicYearId, open);

  return (
    <section className="space-y-3">
      <div>
        <h3 className="font-semibold">SHS Elective Policies</h3>
        <p className="text-sm text-muted-foreground">
          Elective Policy controls how many Academic and TechPro electives a
          student may select for each Term and SHS grade. Curriculum separately
          defines which subjects the school offers. Minimum 0 makes elective
          selection optional; 0 minimum and 0 maximum permits no elective
          selection for that Term.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border p-3">
        {termsLoading || policiesLoading ? (
          <p className="text-sm text-muted-foreground">Loading elective policies...</p>
        ) : error ? (
          <p className="text-sm text-destructive">
            Unable to load SHS elective policies.
          </p>
        ) : terms?.length ? (
          terms.map((term) => (
            <div key={term.id} className="space-y-2 rounded-md bg-muted/40 p-3">
              <div className="flex items-center gap-2">
                <AcademicTermBadge position={term.position} name={term.name} />
                {term.name.trim().toLocaleLowerCase() !==
                  `term ${term.position}`.toLocaleLowerCase() && (
                  <span className="text-sm text-muted-foreground">{term.name}</span>
                )}
              </div>
              <div className="space-y-2">
                {GRADES.map((gradeLevel) => (
                  <PolicyRow
                    key={`${gradeLevel}-${policies?.find((item) => item.academicTermId === term.id && item.gradeLevel === gradeLevel)?.updatedAt ?? "new"}`}
                    academicYearId={academicYearId}
                    term={term}
                    gradeLevel={gradeLevel}
                    policy={policies?.find(
                      (item) =>
                        item.academicTermId === term.id &&
                        item.gradeLevel === gradeLevel,
                    )}
                    readOnly={readOnly}
                  />
                ))}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            Configure Academic Terms before adding elective policies.
          </p>
        )}
      </div>
    </section>
  );
}

function PolicyRow({
  academicYearId,
  term,
  gradeLevel,
  policy,
  readOnly,
}: {
  academicYearId: string;
  term: AcademicTermListItem;
  gradeLevel: (typeof GRADES)[number];
  policy?: ShsElectiveEnrollmentPolicy;
  readOnly: boolean;
}) {
  const [minimumElectives, setMinimumElectives] = useState(
    policy?.minimumElectives ?? 1,
  );
  const [maximumElectives, setMaximumElectives] = useState(
    policy?.maximumElectives ?? 3,
  );
  const createPolicy = useCreateShsElectiveEnrollmentPolicy();
  const updatePolicy = useUpdateShsElectiveEnrollmentPolicy();
  const isPending = createPolicy.isPending || updatePolicy.isPending;
  const isInvalid = minimumElectives > maximumElectives;
  const isUnchanged =
    policy?.minimumElectives === minimumElectives &&
    policy.maximumElectives === maximumElectives;

  async function save() {
    const values = {
      academicYearId,
      academicTermId: term.id,
      gradeLevel,
      minimumElectives,
      maximumElectives,
    };

    try {
      const result = policy
        ? await updatePolicy.mutateAsync({ id: policy.id, values })
        : await createPolicy.mutateAsync(values);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.success);
    } catch {
      toast.error("Unable to save the SHS elective policy. Try again.");
    }
  }

  if (readOnly && !policy) {
    return (
      <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
        <span className="font-medium">Grade {gradeLevel}</span>
        <span className="text-sm text-muted-foreground">Not configured</span>
      </div>
    );
  }

  const fieldPrefix = `${term.id}-${gradeLevel}`;

  return (
    <div className="grid items-end gap-3 rounded-md border bg-background p-3 sm:grid-cols-[1fr_7rem_7rem_auto]">
      <p className="self-center font-medium">Grade {gradeLevel}</p>
      <Field>
        <FieldLabel htmlFor={`${fieldPrefix}-minimum`}>Minimum</FieldLabel>
        <Select
          value={String(minimumElectives)}
          onValueChange={(value) => setMinimumElectives(Number(value))}
          disabled={readOnly || isPending}
        >
          <SelectTrigger id={`${fieldPrefix}-minimum`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ELECTIVE_COUNTS.map((count) => (
              <SelectItem key={count} value={String(count)}>
                {count}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${fieldPrefix}-maximum`}>Maximum</FieldLabel>
        <Select
          value={String(maximumElectives)}
          onValueChange={(value) => setMaximumElectives(Number(value))}
          disabled={readOnly || isPending}
        >
          <SelectTrigger id={`${fieldPrefix}-maximum`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ELECTIVE_COUNTS.map((count) => (
              <SelectItem key={count} value={String(count)}>
                {count}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Button
        type="button"
        size="sm"
        variant={policy ? "outline" : "default"}
        disabled={readOnly || isPending || isInvalid || Boolean(isUnchanged)}
        onClick={() => void save()}
      >
        {isPending ? "Saving..." : policy ? "Save" : "Create"}
      </Button>
      {isInvalid && (
        <p className="text-sm text-destructive sm:col-start-2 sm:col-span-3">
          Minimum electives cannot exceed maximum electives.
        </p>
      )}
    </div>
  );
}
