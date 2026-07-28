# Wizard Framework

## Purpose

Reusable multi-step workflow engine for NEMESYS.

## Responsibilities

- Manage step navigation.
- Display current step.
- Provide Previous / Next / Cancel actions.
- Reset state when closed.

## Does NOT

- Upload files.
- Parse Excel.
- Validate data.
- Save records.

## Used By

- ImportWizard
- Enrollment Wizard
- Promotion Wizard
- Graduation Wizard
- Teacher Assignment Wizard
- Future multi-step workflows

## ImportWizard

`components/common/import/ImportWizard` composes the generic wizard shell with
shared spreadsheet parsing, preview, validation presentation, summary, and
React Query refresh behavior. Feature wrappers provide the entity label,
normalizer, validator, import action, and query key.

Student and Subject import domain rules remain feature-specific.
