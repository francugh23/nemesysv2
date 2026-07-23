# ImportDialog

## Purpose

Reusable wizard dialog used for importing data into NEMESYS.

## Responsibilities

- Open and close the import wizard.
- Maintain the current wizard step.
- Reset the wizard when closed.
- Provide a consistent layout for every import flow.

## Does NOT

- Parse Excel files.
- Parse CSV files.
- Validate records.
- Import records.
- Display business-specific information.

## Used By

- Students
- Teachers
- Users
- Subjects
- Sections
- Class Assignments

## Internal State

Maintains:

- Current Step Index

Receives:

- Array of ImportStep

Displays:

- Current Step Header
- Current Step Content

## Navigation

Provides:

- Previous
- Next
- Cancel

Maintains:

- Current step index

Automatically:

- Prevents going before the first step.
- Prevents going past the final step.
- Resets to step 1 whenever the dialog closes.