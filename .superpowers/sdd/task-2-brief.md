# Task 2: Regenerate TypeScript types

**Location in plan:** Task 2  
**Depends on:** Task 1 ✅ (schema change completed)  
**Effort:** 5 minutes (mostly waiting for Convex codegen)

After schema changes, Convex auto-generates new TypeScript types. This task regenerates them so the new `category` field is available to all other tasks.

## What You're Doing

Run Convex codegen to regenerate types based on the updated schema:

1. Run `bun convex dev --once` (waits for codegen to complete, then exits)
2. Run `bun tsc -b --noEmit` to verify TypeScript compiles
3. Expect: TypeScript errors in dependent code (will be fixed by later tasks)

## Why This Task

The schema change in Task 1 invalidated the generated types in `src/convex/_generated/`. Running `bun convex dev --once` regenerates them to include the new `category` field. All tasks after this depend on the new types.

## Files You'll Touch

- **Generated:** `src/convex/_generated/` (auto-generated, do not edit)
- No source files modified in this task

## Steps

1. Run: `bun convex dev --once`
   - Expected output: Completes without error, regenerates `src/convex/_generated/api.ts` and related files
   - This may take 10–30 seconds

2. Run: `bun tsc -b --noEmit`
   - Expected output: TypeScript errors from dependent code (that's okay — later tasks fix them)
   - Errors should be in files that reference old fields (`doctors.ts`, `appointments.ts`, `seed.ts`, UI components)

3. Report results (no commit needed for this task)

## Report

Write your report to: `.superpowers/sdd/task-2-report.md`

Include:
- Status: DONE if codegen completed and types were regenerated; BLOCKED if codegen failed
- Commands run and their output (brief summary)
- Number of TypeScript errors after regeneration (expected to match or decrease from Task 1)
