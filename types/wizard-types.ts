import { ReactNode } from "react";

export interface WizardStep {
  id: string;
  title: string;
  description?: string;
  content: ReactNode;
}
