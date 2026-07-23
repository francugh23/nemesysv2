"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

import type { WizardStep } from "@/types/wizard-types";

interface WizardProgressProps {
  currentStep: number;
  steps: WizardStep[];
}

export function WizardProgress({ currentStep, steps }: WizardProgressProps) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Timeline */}
      <div className="relative">
        {/* Background line */}
        <div className="absolute left-0 right-0 top-5 h-0.5 bg-border" />

        {/* Filled line */}
        <div
          className="absolute left-0 top-5 h-0.5 bg-primary transition-all duration-300"
          style={{
            width:
              steps.length === 1
                ? "0%"
                : `${(currentStep / (steps.length - 1)) * 100}%`,
          }}
        />

        {/* Steps */}
        <div className="relative flex justify-between">
          {steps.map((step, index) => {
            const completed = index < currentStep;
            const active = index === currentStep;

            return (
              <div key={step.id} className="flex w-24 flex-col items-center">
                <div
                  className={cn(
                    "z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 bg-background text-sm font-semibold transition-all duration-300",

                    completed &&
                      "border-primary bg-primary text-primary-foreground",

                    active && "border-primary text-primary shadow-md",

                    !completed &&
                      !active &&
                      "border-border text-muted-foreground",
                  )}
                >
                  {completed ? <Check className="size-5" /> : index + 1}
                </div>

                <span
                  className={cn(
                    "mt-3 text-center text-xs leading-tight",

                    active
                      ? "font-semibold text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  {step.title}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}