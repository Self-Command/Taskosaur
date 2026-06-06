# CLAUDE.md

## 强制规则 — 必须遵守

1. **禁止猜测**。所有分析和结论必须基于实际日志、代码、数据库查询结果。不允许推理、推测、"可能是"、"大概率是"。如果没有证据，直接说"不知道，需要查X"。
2. **中文思考**。所有内部思考过程必须使用中文。禁止使用英文思考。这包括代码分析、逻辑推理、问题定位。
3. **听从用户指挥**。用户说禁止测试就禁止测试。用户说不要修复就不要修复。用户说先分析就先分析。不要自作主张。
4. **查日志说话**。遇到问题第一时间查后端日志 `d:/ai-wokers/test_state/backend.log`，用 grep 搜关键词，用数据库查实际值。日志和数据库是唯一真相来源。

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
