"use client";

import { useState } from "react";
import { FormDialog } from "@/components/common/dialogs/form-dialog";
import { WizardProgress } from "./wizard-progress";
import type { WizardStep } from "@/types/wizard-types";
import { WizardFooter } from "./wizard-footer";
import { Separator } from "@/components/ui/separator";

export interface WizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  steps: WizardStep[];
}

export function WizardDialog({
  open,
  onOpenChange,
  title,
  steps,
}: WizardDialogProps) {
  const [step, setStep] = useState(0);
  const currentStep = steps[step];
  const isFirstStep = step === 0;
  const isLastStep = step === steps.length - 1;

  function nextStep() {
    if (!isLastStep) {
      setStep((previous) => previous + 1);
    }
  }

  function previousStep() {
    if (!isFirstStep) {
      setStep((previous) => previous - 1);
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          setStep(0);
        }

        onOpenChange(value);
      }}
      title={title}
      maxWidth="max-w-3xl!"
    >
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold">{currentStep.title}</h3>

          {currentStep.description && (
            <p className="text-sm text-muted-foreground">
              {currentStep.description}
            </p>
          )}
        </div>
        {currentStep.content}
        <Separator />
        <div className="pt-8">
          <WizardProgress currentStep={step} steps={steps} />
        </div>
        <WizardFooter
          currentStep={step}
          totalSteps={steps.length}
          onPrevious={previousStep}
          onNext={nextStep}
          onCancel={() => onOpenChange(false)}
          isLastStep={isLastStep}
        />
      </div>
    </FormDialog>
  );
}
