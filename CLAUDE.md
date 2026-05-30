# CLAUDE.md

## Core Constraint: Analyze Before Acting

**CRITICAL — READ THIS FIRST BEFORE ANY TOOL USE:**

When the user asks to debug, fix, investigate, or find the root cause of any issue:

1. **READ phase**: Read ALL relevant source files completely. Do not stop after 2-3 files.
2. **ANALYZE phase**: Write a complete analysis report covering:
   - Every bug found, with file paths and line numbers
   - Root cause of each bug
   - How bugs interact with each other
   - The full data flow / call chain affected
3. **REPORT phase**: Present the analysis to the user in plain text.
4. **WAIT phase**: Do NOT make any edits, write any code, or run any fixes until the user explicitly says "fix it", "修复", or gives clear approval.

**DO NOT skip from reading directly to editing. The user MUST see and approve the analysis first.**

## When Fixing

- Prefer minimal, targeted changes over large refactors
- Fix root causes, not symptoms
- Verify with TypeScript compilation before reporting success
- Restart services after backend changes
