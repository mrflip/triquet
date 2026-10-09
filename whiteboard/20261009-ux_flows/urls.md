# The URL tree, as built and as addressed

2026-10-09, at `ec3184a0`, from `src/app/` and `notes/decisions/urls.md`. **served** means a page
answers; **addressed** means `Addresses` names it (a key path, a file in the hunt's repository, a
place in the jsonball) and no page answers yet; **old** means a pre-October address that still
opens and moves on.

```
/                                   served   front door: say who you are; ?then=, ?switch
/about                              served
/stats                              served   admin; linked from nowhere, by design
/my/hunts                           served   the visitor's hunts, whosever
/api/ask, /api/bots                 served   the one named server function, and its roster

/~{org}                             served   the org's hunts, of those the visitor is on
/~{org}/{hunt}                      served   hunt page: quizzes, branch, history, wheel link, members (read)
/~{org}/{hunt}/quizzes              served   every quiz, by label (reached by no link)
/~{org}/{hunt}/categories           served   the wheel
/~{org}/{hunt}/members              addressed
/~{org}/{hunt}/images/{image}       future
/~{org}/{hunt}@{ref}/…              future   the hunt at a ref or a commit
/~{org}/{hunt}/quizzes/home/{quiz}            served   moves to the mode the role works in
/~{org}/{hunt}/quizzes/home/{quiz}/!edit      served   the Workbench
/~{org}/{hunt}/quizzes/home/{quiz}/!playtest  served   the ReviewScreen
/~{org}/{hunt}/quizzes/home/{quiz}/!{view}    future   a user-created view
/~{org}/{hunt}/quizzes/home/{quiz}/questions          addressed  the questions alone, pasteable anywhere
/~{org}/{hunt}/quizzes/home/{quiz}/reviews/{ident}    addressed  one shared review
{any of these but an org}.json      addressed  the raw record

/pub/widgets/{widget}               addressed  a widget of the library, in its scope

/h/{hunt}                           old  → /~{org}/{hunt}
/h/{hunt}/{realm}/{quiz}?act=…      old  → …/quizzes/{realm}/{quiz}/!{mode}
/c/{hunt}/categories                old  → /~{org}/{hunt}/categories
```

## What is in the address and not in the navigation, and the reverse

| Thing | In the URL tree | In the navigation | In the relations |
|---|---|---|---|
| org | a page | breadcrumb | the hunt's `orglabel`, an ident's label |
| quizzes list | a page | nothing links to it | the realm's children |
| members | addressed, unserved | a quiz's panel (write), the hunt page (read) | hunt has many huntings |
| review | addressed, unserved | `!playtest` for one's own; a panel for the others' | quiz × ident |
| widget, library | addressed, unserved | a modal behind two doors; a tab for bulk | a scope, apart from every hunt |
| questions alone | addressed, unserved | the Import tab reads the paste | the quiz's children |
| gear sections | nothing | one dialog, many sections | columns and widgetings are the quiz's children |
| mode | the last segment | picked by role; a smith can open `!playtest` from Members | not a row |
| realm | a fixed segment | invisible | a row, `home` only |
| branch, history | nothing | three doors | the hunt's `branch`; the mirror in the browser |
