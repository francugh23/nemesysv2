# PROJECT_CONTEXT.md

# NEMESYS v2

**Project Name:** NEMESYS v2  
**Purpose:** School Information System for a Philippine Public High School (Junior High School + Senior High School)

---

# Current Development Phase

Current milestone:

> **Phase 5A.7 – Create Server Action**

Nothing from Phase 5A.7 has been implemented yet.

The project currently has:

- Student CRUD completed
- Student Module UI completed
- Import Wizard foundation completed
- Excel parsing completed
- Validation completed

The next task is wiring the wizard to the database.

---

# Tech Stack

## Framework

- Next.js (App Router)
- React
- TypeScript

## UI

- TailwindCSS
- shadcn/ui
- Lucide Icons

## Table

- TanStack Table

## Data Fetching

- TanStack React Query

## ORM

- Prisma

## Database

- PostgreSQL

## Excel

- xlsx

---

# Project Architecture

The project follows a feature-first architecture while keeping reusable UI in shared folders.

Typical layout:

```
app/
actions/
components/
hooks/
lib/
repositories/
schemas/
services/
types/
```

Shared UI lives in:

```
components/common/
```

Business features live near their pages.

---

# Coding Conventions

## General

- TypeScript only
- Functional components
- Prefer composition
- No class components

---

## React

Prefer:

- useMemo
- useCallback only when needed
- React Query instead of prop drilling whenever appropriate

---

## Forms

Current forms are manually managed.

Future migration to React Hook Form + Zod is acceptable.

---

## Naming

PascalCase

```
StudentDialogManager
StudentToolbar
StudentInfoSection
```

camelCase

```
useStudents
deleteStudentAction
studentColumns
```

---

## Server Actions

Located in:

```
actions/
```

Pattern:

```
student.action.ts
student-import.action.ts
```

---

## Hooks

Located in:

```
hooks/
```

Pattern:

```
student.hook.ts
```

---

# Student Module

Completed.

## Features

### Data Table

- TanStack Table
- Sorting
- Filtering
- Pagination
- Search

Reusable DataTable component.

---

### Dialogs

Implemented:

- View
- Edit
- Delete

Managed by:

```
StudentDialogManager
```

instead of local dialog state inside actions.

---

### Delete

Uses LRN confirmation.

Workflow:

```
Type student's LRN
↓

Delete enabled
```

Uses React Query invalidateQueries after success.

---

### View Dialog

Uses reusable components:

```
StudentInfoSection
StudentInfoItem
```

Grouped layout.

---

### Edit Dialog

Currently functional.

Future enhancement:

Same grouped UI as View Dialog.

Decision already made.

Not priority.

---

# Import Wizard

Currently implemented as:

```
WizardDemo
```

This is intentionally temporary.

Eventually replaced by:

```
StudentImportDialog
```

---

## Wizard Framework

Reusable.

Components:

```
WizardDialog
WizardFooter
WizardProgress

WizardStepUpload
WizardStepPreview
WizardStepValidation
WizardStepSummary
```

Progress indicator is timeline style.

Motion/polish intentionally postponed.

---

# Import Workflow

Current flow:

```
Upload
↓

Preview

↓

Validation

↓

Summary
```

---

## Upload Step

Completed.

Supports:

- xlsx
- csv

Displays selected filename.

---

## Preview Step

Completed.

Uses:

```
xlsx
```

Reads workbook.

Converts first sheet to JSON.

Displays preview table.

---

## Validation Step

Completed.

Current validation:

- required columns
- required values
- duplicate LRN
- gender validation

Validator:

```
lib/student-import-validator.ts
```

---

## Summary Step

Completed.

Displays:

- record count

No database import yet.

---

# Current Stopping Point

Next implementation:

## Phase 5A.7

Create

```
actions/student-import.action.ts
```

Responsibilities:

- receive validated rows
- map rows to Prisma Student model
- insert into PostgreSQL
- transaction support
- duplicate handling
- success/failure counts
- invalidate React Query
- refresh Student table

Nothing from this phase has been implemented.

---

# Future Roadmap

## Phase 5A

Finish Student Import

- Server Action
- Database insert
- Import results
- Refresh UI

---

## Phase 5B

Export

Implement:

- Excel template download
- Import template
- Export Students
- Reusable export system

Should be reusable for:

- Teachers
- Subjects
- Users
- Class Assignments

---

## Phase X

Motion & Polish

After functional completion.

Includes:

- Framer Motion
- Step transitions
- Progress animation
- Better empty states
- Success animations
- Micro interactions

Deferred intentionally.

---

## Phase 6

Teacher Module

Will follow Student Module architecture.

Expected:

CRUD

Import

Export

Assignment

Reuse existing wizard framework.

---

# Architectural Decisions

## Dialog Management

Single manager.

```
StudentDialogManager
```

instead of dialog state inside action buttons.

---

## Import Wizard

Current:

```
WizardDemo
```

Temporary.

Eventually replaced by:

```
StudentImportDialog
```

---

## Wizard State

Do NOT prematurely optimize.

When StudentImportDialog exists:

Wizard owns state.

Steps remain dumb/presentational.

---

## Data Table

Generic reusable component.

Supports:

- toolbar
- row click
- pagination
- filtering

---

## Import System

Designed to become reusable.

Future modules should reuse same pipeline:

```
Upload

↓

Preview

↓

Validation

↓

Summary
```

Only validators and mappings change.

---

# Important User Preferences

The project owner prefers:

- Clean architecture over shortcuts.
- Reusable components.
- Feature-first organization.
- Consistent naming.
- Incremental development.
- No unnecessary abstractions.
- Finish functionality first.
- Polish only after features are complete.

When explaining implementation:

- Be direct.
- Give explicit file names.
- Give one step at a time.
- Avoid debating architectural alternatives unless necessary.

---

# Final Note

The project is intentionally built as a long-term maintainable school management system rather than a CRUD demo.

Favor maintainability and consistency over cleverness.