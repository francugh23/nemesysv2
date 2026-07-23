"use client";

import { Button } from "@/components/ui/button";

interface WizardFooterProps {
  currentStep: number;
  totalSteps: number;
  onPrevious: () => void;
  onNext: () => void;
  onCancel: () => void;
  isLastStep?: boolean;
}

export function WizardFooter({
  currentStep,
  totalSteps,
  onPrevious,
  onNext,
  onCancel,
  isLastStep = false,
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
        <Button onClick={onNext}>{isLastStep ? "Finish" : "Next"}</Button>
      </div>
    </div>
  );
}