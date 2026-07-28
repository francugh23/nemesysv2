# Import Wizard

## Purpose

Reusable import workflow for importing data into NEMESYS.

## Responsibilities

- Parse the first worksheet from XLSX and CSV files.
- Preview normalized records.
- Present feature-provided validation results.
- Provide a consistent multi-step layout for every import flow.
- Invalidate the feature-provided React Query key after a successful import.

## Does NOT

- Define domain normalization rules.
- Define domain validation rules.
- Persist records.
- Decide duplicate or authorization behavior.

## Used By

- Students
- Subjects
- Future feature-specific import wrappers

## Internal State

Maintains the selected file, parsed rows, and wizard state.

Receives feature configuration for the entity label, row normalizer, row
validator, server action, and React Query key.

Displays:

- Current WizardStep header
- Current WizardStep content

## Navigation

Provides:

- Previous
- Next
- Cancel

Maintains:

Automatically:

- Prevents going before the first step.
- Prevents going past the final step.
- Resets file and parsed-row state whenever the dialog closes.
