"use client";

import { useState } from "react";
import { FormDialog } from "@/components/common/dialogs/form-dialog";
import { WizardProgress } from "./wizard-progress";
import type { WizardStep } from "@/types/wizard-types";
import { WizardFooter } from "./wizard-footer";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface WizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  steps: WizardStep[];
  onFinish?: () => void | Promise<void>;
  isFinishing?: boolean;
  isFinishDisabled?: boolean;
}

export function WizardDialog({
  open,
  onOpenChange,
  title,
  steps,
  onFinish,
  isFinishing = false,
  isFinishDisabled = false,
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

  function finish() {
    void onFinish?.();
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
      maxWidth="max-w-3xl! h-[80vh] max-h-[44rem]! overflow-hidden! flex! flex-col!"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0">
          <h3 className="text-lg font-semibold">{currentStep.title}</h3>

          {currentStep.description && (
            <p className="text-sm text-muted-foreground">
              {currentStep.description}
            </p>
          )}
        </div>
        <ScrollArea className="min-h-0 flex-1 py-6 pr-4">
          {currentStep.content}
        </ScrollArea>
        <Separator className="shrink-0" />
        <div className="shrink-0 pt-8">
          <WizardProgress currentStep={step} steps={steps} />
        </div>
        <WizardFooter
          currentStep={step}
          onPrevious={previousStep}
          onNext={isLastStep ? finish : nextStep}
          onCancel={() => onOpenChange(false)}
          isLastStep={isLastStep}
          isNextDisabled={isLastStep && (isFinishing || isFinishDisabled)}
          nextLabel={isLastStep && isFinishing ? "Importing..." : undefined}
        />
      </div>
    </FormDialog>
  );
}
