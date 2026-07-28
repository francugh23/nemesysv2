# Reusable Prompts

This directory holds reusable task prompts that standardize recurring engineering work without embedding current feature state.

Prompts should:
- reference `AGENTS.md`, `.ai/context/architecture.md`, and relevant skills;
- state scope, exclusions, approval requirements, and verification commands;
- request evidence before conclusions in reviews and investigations;
- avoid copying roadmap or completed-feature details from `project-context.md`.

Create a prompt only when the workflow will be reused. Task-specific plans belong in the conversation, not this directory.

## End-of-Phase Checklist
Use this sequence after every approved feature phase or subphase:

1. Run required verification and record the results.
2. Promote reusable knowledge into the appropriate `.ai` resource without duplicating existing guidance.
3. Update `docs/architecture/project-context.md` to reflect current implementation state and decisions.
4. Inspect `git status` and diffs; run `git add`, commit, and push only when explicitly requested.
5. Run `/compact` only after repository knowledge and requested Git work are complete.
6. Begin the next phase only after it is approved.
