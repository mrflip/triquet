# 2026-10-08: Templates are Liquid now; stored mustache templates need converting before merging

Field templates and the recap template are LiquidJS (`20261008-liquid_templates`). Prompt
templates stay mustache.

**What still reads the same:** a plain tag, `{{qn.author}}` or `{{quiz.title}}`, is Liquid too.
A recap head or tail with no tags is untouched.

**What breaks:** anything with a mustache section, `{{#...}}`, `{{^...}}` or `{{/...}}`, or
`{{! comment }}`. Once merged, it shows Liquid's issue in red and fills in as typed. The default
recap template is in code and has moved already. A quiz's own recap template written in mustache
(yours from the recap night, say) has not.

To see what production holds, before merging:

```
./scripts/doppledo prd_janitor npx convex data quizzes --limit 10000 --format jsonl | jq -c 'select(.recap_template != null or (.templated | length) > 0 or ((.recap_head + " " + .recap_tail) | test("\\{[{%]"))) | {label, templated, own_recap_template: (.recap_template != null), head_or_tail_tags: ((.recap_head + " " + .recap_tail) | test("\\{[{%]"))}'
```

If it is a handful, paste them to an agent and have it write the Liquid versions to paste back.
If it is more, a backfill converting the common shapes (a loop over `qns`, `{{#field}}` as
`{% if %}`, the helpers as filters) is a thread of its own.

What the default recap now does differently: questions in Q# order, numbered past alternates;
questions with no Q# that hold a clueing come last; the rule under the head only when a question
follows. `played` and its pre-shaped values (`quoted.clueing` and the rest) are gone; a template
reading them fills them in as nothing.

**Checked 2026-10-08, with the Coach:** production's six quizzes hold no recap template of their
own, template no field (`templated` empty everywhere), and have blank recap heads and tails.
Nothing to convert; the PR may merge as it stands.
