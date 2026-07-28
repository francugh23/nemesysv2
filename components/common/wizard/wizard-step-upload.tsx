"use client";

import { Upload } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";

interface WizardStepUploadProps {
  entityLabel: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
}

export function WizardStepUpload({
  entityLabel,
  file,
  onFileChange,
}: WizardStepUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col items-center justify-center space-y-6 rounded-lg border-2 border-dashed p-12">
      <div className="rounded-full bg-primary/10 p-4">
        <Upload className="size-8 text-primary" />
      </div>

      <div className="space-y-2 text-center">
        <h3 className="text-lg font-semibold">Upload {entityLabel} File</h3>

        <p className="text-sm text-muted-foreground">
          Drag and drop your Excel or CSV file here, or browse your computer.
        </p>
      </div>

      <Button onClick={() => inputRef.current?.click()}>Browse Files</Button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.csv"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          onFileChange(file);
        }}
      />

      <p className="text-xs text-muted-foreground">
        Supported formats: .xlsx, .csv
      </p>
      {file && (
        <div className="rounded-md border bg-muted px-4 py-3 text-sm">
          📄 {file.name}
        </div>
      )}
    </div>
  );
}
