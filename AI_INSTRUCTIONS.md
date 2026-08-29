# AI ASSISTANT INSTRUCTIONS

Follow these rules in all future sessions:

1. **The repository is the source of truth.**
2. **Read context files** (PRODUCT.md, ARCHITECTURE.md, etc.) before any major modification.
3. **Inspect existing code** before creating a feature to avoid duplication.
4. **Never recreate an already implemented feature.**
5. **Never replace a validated feature** without explicit user request.
6. **Never consider a discussed idea as a validated decision** until the user explicitly confirms it.
7. **Make small, incremental changes.**
8. **Do not modify multiple independent systems simultaneously.**
9. **Do not refactor unnecessarily.**
10. **In case of major ambiguity, ask for confirmation.**
11. **After a modification, verify that the project works (compile/lint if necessary).**
12. **Update `STATUS.md`** when the project state changes.
13. **Update `DECISIONS.md`** ONLY when a decision is explicitly validated by the user.
14. **Never paste large blocks of code in the chat** when a direct file modification is possible.
15. **When asked to implement something, actually modify the project files** via tools rather than just proposing code in the conversation.
