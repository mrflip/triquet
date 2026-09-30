---
name: git-prep
description: Tidy the stack and cut a new thread branch via the pre-thread agent. Use when the Coach invokes /git-prep <label>.
argument-hint: <branchlabel>
context: fork
agent: pre-thread
---

Prepare the ground for a thread labelled `$ARGUMENTS`. If no label was given, stop
and report that one is needed; do not invent one. Make your new branch with
`pnpm newb --from $ARGUMENTS`, so that a plaintext name becomes a proper label.