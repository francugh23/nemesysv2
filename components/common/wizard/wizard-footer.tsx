"use client";

import { Button } from "@/components/ui/button";

interface WizardFooterProps {
  currentStep: number;
  onPrevious: () => void;
  onNext: () => void;
  onCancel: () => void;
  isLastStep?: boolean;
  isNextDisabled?: boolean;
  nextLabel?: string;
}

export function WizardFooter({
  currentStep,
  onPrevious,
  onNext,
  onCancel,
  isLastStep = false,
  isNextDisabled = false,
  nextLabel,
}: WizardFooterProps) {
  return (
    <div className="flex items-center justify-between border-t pt-6">
      <Button variant="outline" onClick={onCancel}>
        Cancel
      </Button>
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={currentStep === 0}
          onClick={onPrevious}
        >
          Previous
        </Button>
        <Button disabled={isNextDisabled} onClick={onNext}>
          {nextLabel ?? (isLastStep ? "Finish" : "Next")}
        </Button>
      </div>
    </div>
  );
}
