# 2026-10-09: The Percent seed reaches production only when seeded by hand

Thread 4 of little_fixes_b adds a `percent` entry kind, offered after *A number*: 0 to 100, with
`%` shown in its box. It also adds a seed widget, `percentage`, titled Percent. A fresh library
gets the seed at once. Production's library gets it only when someone runs:

```
./scripts/doppledo prd_janitor npx convex run seeding:seedWidgets
```

This is safe to run again: it adds only seeds the library lacks. Until it is run, a smith can
still make a percent entry from *New widget… › An entry › A percent*.

Your own `correct_pct` widget stays as it is: a number entry, labelled `correct_pct`. To move to
the new kind, make a Percent widgeting where it is used, or retire `correct_pct`. That is your
call; nothing here relabels your data. The recap's default template still reads
`{{ qn.correct_pct }}`.

The schema change is a widening only: the widget row's config gains a `percent` member. Every
stored row still fits, so there is no backfill and no Serial Deploy.
