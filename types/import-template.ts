import type { DownloadableArtifact } from "@/types/export";

export interface ImportTemplateField {
  key: string;
  canonicalHeader: string;
  displayLabel: string;
  required: boolean;
  aliases: readonly string[];
  acceptedValues: string;
  format: string;
  notes: string;
}

export interface ImportTemplateWorksheet {
  sheetName: string;
  fields: readonly ImportTemplateField[];
}

export interface ImportTemplateDefinition {
  fileSlug: string;
  importWorksheet: ImportTemplateWorksheet;
  includeInstructions: boolean;
  additionalWorksheets?: readonly ImportTemplateWorksheet[];
}

export type ImportTemplateFile = DownloadableArtifact;

export type ImportTemplateActionResult =
  | { file: ImportTemplateFile; error?: never }
  | { file?: never; error: string };
