"use client";

interface WizardStepSummaryProps {
  entityLabel: string;
  rows: Record<string, unknown>[];
}

export function WizardStepSummary({ entityLabel, rows }: WizardStepSummaryProps) {
  return (
    <div className="space-y-4 rounded-md border p-6">
      <h3 className="font-semibold">Ready to Import</h3>

      <p className="text-sm text-muted-foreground">
        The following {entityLabel.toLowerCase()} records will be imported.
      </p>

      <div className="rounded-md bg-muted p-4 text-sm">
        Total Records:
        <span className="ml-2 font-semibold">{rows.length}</span>
      </div>
    </div>
  );
}
