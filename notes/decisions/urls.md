# Triquet URL Scheme

Oct 5, 2026 · @Philip F Kromer

Brought up to date with what the hunt_git sprint built (threads 0 to 8, October 2026). Where this
page says *as built*, `src/lib/addresses.ts` (`Addresses`) and `src/lib/routes.ts` (`Routes`, the
one writer of an address) are the code.

## Scheme

Every URL is an org, a hunt with an optional version, a path of nouns, and an optional mode.
(An org, for now, is an ident label: a hunt stores its maker's as its `orglabel`, copied when it is
made and never changed.)

As built, each served by a page:

```
/~{org}                                      an org's hunts (those the visitor is on)
/~{org}/{hunt}                               hunt home
/~{org}/{hunt}/quizzes                       all quizzes, by label
/~{org}/{hunt}/quizzes/home/{quiz}           a quiz: moves to the mode the visitor works in (rule 4)
/~{org}/{hunt}/quizzes/home/{quiz}/!{mode}   !edit (a smith's), !playtest (a reviewer's)
/~{org}/{hunt}/categories                    the hunt's wheel of categories
/my/hunts                                    the visitor's own hunts, whosever: the app's landing page
```

Named by the address model, and written as files (*Key paths and files*, below), but served by no
page yet:

```
/~{org}/{hunt}/members                               who is on the hunt
/~{org}/{hunt}/quizzes/home/{quiz}/questions         a quiz's questions alone
/~{org}/{hunt}/quizzes/home/{quiz}/reviews/{ident}   one reviewer's shared review of it
/pub/widgets/{widget}                                a widget of the library, in its scope (`pub`)
{any of these but an org}.json                       the raw record: the address's last label ending in `.json`
```

Future, with room left in the model for each:

```
/~{org}/{hunt}@{ref}/…, /~{org}/{hunt}@!{sha}/…    the hunt at a named ref, or at a commit
/~{org}/{hunt}/quizzes/home/{quiz}/!{view}         a user-created view
/~{org}/{hunt}/images/{image}                      shared images
/~{org}/{hunt}/categories/{category}               one category
```

Example: `/~pat_smith/spring_hunt@go_live/quizzes/home/legends/!playtest` (note: includes future proposals; an org is an ident's label, 6 to 24 characters)

| Part                  | In the example | Meaning                                          |
| --------------------- | -------------- | ------------------------------------------------ |
| `~{org}`              | `~pat_smith`   | The org that owns the hunt                       |
| `{hunt}`              | `spring_hunt`  | The hunt, named within its org                   |
| `@{ref}` or `@!{sha}` | `@go_live`     | future: the hunt at a named ref or at a commit   |
| `quizzes`             | `quizzes`      | A collection, from a fixed vocabulary            |
| `{realm}`             | `home`         | The realm, `home` alone for now                  |
| `{quiz}`              | `legends`      | The quiz, unique within the hunt                 |
| `!{mode}`             | `!playtest`    | Optional: how the quiz is opened                 |

## Serialized files

* Each serialized file matches its url path.
* Within the file, the json path matches the url path.
* In addition to the regular jsonball files, there is a questions json file suitable for pasting the question contents across quizzes
  - Deep-merging the jsonball files within a repo reconstitutes the hunt, which is not itself serialized
  - in `/~org/hunt/categories.tqc.json`:              `{ "categories": { "categorylabel": { ... } }   }`
  - in `/~org/hunt/quizzes/{realm}/{quizlabel}.tqq.json`: `{ "quizzes": { "{realm}": { "{quizlabel}": { ... } } } }`
* Each file type has a short pre-extension: .xx.json
* Files are exported as:
  - json, pretty-printed, with keys alphabetized. No array fields
  - tsv, with columns sorted alphabetically by label, and rows sorted by label
* As built: *Key paths and files*, below, and `notes/hunt_git.md`, the index of every file, its shape and its table

## Key paths and files

**One key path makes all three.** Every resource has a key path (`Addresses.keypathOf`): the nouns
and labels below its hunt, or for a widget from its scope down. Its URL, its file in the hunt's
repository and where its piece sits in a jsonball are each made from that one list, so the three
cannot drift apart.

| Resource | Key path | URL | File (rule 10) |
|---|---|---|---|
| hunt | `[]`, the root | `/~pat_smith/spring_hunt` | `hunt.tqh.json` |
| categories | `categories` | `…/categories` | `categories.tqc.json` |
| members | `members` | `…/members` | `members.tqm.json` |
| quiz | `quizzes.home.legends` | `…/quizzes/home/legends` | `quizzes/home/legends.tqq.json` |
| questions alone | `quizzes.home.legends.questions` | `…/quizzes/home/legends/questions` | `quizzes/home/legends/questions.qq.json` |
| review | `quizzes.home.legends.reviews.lee_jones` | `…/quizzes/home/legends/reviews/lee_jones` | `quizzes/home/legends/reviews/lee_jones.tqr.json` |
| widget | `pub.widgets.dumdum` | `/pub/widgets/dumdum` | `pub/widgets/dumdum.tqw.json` |
| the list of quizzes | `quizzes` | `…/quizzes` | none: each quiz is a file |
| an org | none | `/~pat_smith` | none: an org holds hunts, and is part of none |

* **The URL** is the hunt's prefix (`/~{org}/{hunt}`; none for a widget, whose key path starts at
  its scope) and the key path, joined by `/`, then a `/!{mode}` when one is asked for, or `.json`
  on the last label for the raw record (`Addresses.urlOf`, `recordUrlOf`; read back by
  `locationFrom`).
* **The JSON key path** is where the resource's piece of the hunt sits in its jsonball: the ball is
  the body nested under the key path (`Jsonball.ballAt`), so the quiz's file is
  `{ "quizzes": { "home": { "legends": { … } } } }` and the hunt's own fields sit at the root.
  Deep-merging every merged ball (`*.tq?.json`) is the hunt, exactly as Raw Export emits it. Every
  collection is an object keyed by label, never an array, each member carrying its `position`
  where order matters; no body repeats the label its key gives it.
* **The questions alone are the one exception.** Their URL and file follow their key path, but
  their ball is rooted at the quiz, not nested under the key path (`{ "questions": { … } }`), so it
  names no quiz and pastes into any quiz's Import; its `.qq` pre-extension keeps it out of the
  merge, since the quiz's ball holds the same questions (and the archived besides).
* **A widget's key path starts at its scope**, so its ball is `{ "pub": { "widgets": { "dumdum":
  { … } } } }`: it merges with its hunt's balls (for the widgets the hunt's quizzes work), and with
  every other widget's into the library, whose export is the same shape.
* **The repository path** is rule 10: the URL's path less `~{org}/{hunt}`, plus the resource's
  pre-extension (`.tqh`, `.tqc`, `.tqm`, `.tqq`, `.tqr`, `.tqw`; `.qq` for the questions alone) and
  its format, `.json` or the `.tsv` table beside it (`Addresses.filepathOf`). `notes/hunt_git.md`,
  *The index*, lists every file, what it is made from, its shape and its table; this page does not
  repeat it.

## Decisions

The database is the system of record, and the URL names things by label within an org and a hunt.

| Topic              | Decision                                                                                                                      | Reason                                                                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Orgs               | `~{org}` is the top-level scope. Every username is its own org. A hunt stores its org (`orglabel`): its maker's ident label, copied when it is made, never changed. | Hunt names are chosen within an org, not guessed against a global namespace. The sigil keeps the root free for the app's own routes.     |
| Hunt labels        | A hunt label is unique within its org, not across the app: `hunts.open` finds a hunt by org and label. An address naming another org than the hunt's finds no hunt there, and says so, rather than moving. An old address (`/h/{hunt}`), naming no org, finds the earliest hunt of its label. | Takes hunt labels out of a global namespace into one under the namer's control. (The Coach, 2026-10-05.)                                  |
| Org sigil          | Only `~` is emitted.                                                 | `~` is the one sigil that never needs encoding. The alias covers keyboards that lack it.                                                 |
| Labels             | Every label matches `/^[a-z](_?[a-z0-9])+$/`.                                                                                 | Lowercase only, so no case collisions. At least two characters, single underscores, and a linear-time match.                             |
| quizzes            | A quiz label is unique across its hunt.                                                                                       | A bare label always identifies one quiz, so references survive a move.                                                                   |
| Realms             | One realm, `home`, its own label. Its slot stays in the path. (Sketched as `a`, which the label rule refuses: the hunt_git sprint's Decision 1.) The realm validators refuse any other label, by a check the database's schema does not carry. | The URL shape will not change when realms return.                                                                                        |
| Modes              | A trailing `!{mode}` segment: `!edit`, `!playtest`, or a user-created `!{view}`. Built-in names are reserved from user views. As built, `!edit` and `!playtest` alone; any other is not found. | Modes get their own namespace and cannot collide with a noun.                                                                            |
| Versions           | `{hunt}@{ref}` for a named ref, `{hunt}@!{sha}` for a commit. Named refs follow the label rule.                               | A version names the state of the whole hunt, so every link below it stays in that version. The `!` keeps a tag from being read as a SHA. |
| Hunt resources     | `images/` and `categories/` sit beside `quizzes/`.                                                                            | One fixed vocabulary of collections under the hunt.                                                                                      |
| Widgets            | The library's widgets sit under their scope at the root: `/pub/widgets/{widget}`, its file `pub/widgets/{widget}.tqw.json`, its jsonball `{ "pub": { "widgets": { … } } }`. | A widget belongs to no hunt; its scope stands where an org and hunt stand, so rule 10 holds for it too. (The Coach, 2026-10-05.)          |
| Raw record         | Adding `.json` to a resource's URL names the record itself (`Addresses.recordUrlOf`): the address model writes and reads it for any resource, and no page serves one yet. | The same address gives the app view and the data.                                                                                        |
| Query and fragment | The query string adjusts the screen being shown (filter, sort). The fragment marks a position within a quiz.                  | Neither one changes which thing is addressed.                                                                                            |

### Git export

The in-browser git repo is ancillary to the database: an export format with superpowers, kept because diffing back is so valuable.

- **One repo per hunt.** `~{org}/{hunt}` is the repo's address, so transferring a hunt renames a repo and leaves its contents alone. As built, the browser keeps it by the hunt's id (`/hunts/<hunt _id>`), so a relabel neither moves nor strands it, and it downloads as `<hunt label>.zip`.
- **URLs map to files.** `/~{org}/{hunt}/quizzes/home/{quiz}` is `quizzes/home/{quiz}.tqq.json` inside that repo (rule 10).
- **Records only.** Results and media binaries stay out of the repo: of what a widgeting came to, only each cell's latest `status` and `value`.

### Addresses that move, and addresses that lead nowhere

As built (`useCanonical`, `Routes.movedPath`). A move replaces the address rather than pushing
one, so going back skips the form it moved from, and the query and fragment come along.

- **Old addresses keep working**, because people have links and bookmarks: `/h/{hunt}`,
  `/h/{hunt}/{realm}/{quiz}` and `/c/{hunt}/categories`, from before orgs, find the earliest hunt
  of the label and move to its present form; an old quiz address's `?act=smith` becomes `!edit`
  and `?act=review` `!playtest`.
- **A stale realm, or a quiz's old label,** moves to where the quiz is now (rule 6): the quiz's
  label finds it, and a quiz relabelled while open is followed to its new label.
- **A wrong org finds no hunt** (`noSuchHuntNotice`: "There is no hunt labelled … in ~org"),
  rather than moving to the hunt's own: the org is a namespace.
- **A bare quiz address** moves by role (rule 4); anyone not on the hunt stays, and is told whom
  to ask.
- **Not found:** an address of no resource the model knows, an org with no `~` or one too short to
  be an ident's label, a mode the app does not have, and a raw record (`.json`), which no page
  serves yet.

## Rules

A URL should parse on sight: nouns in the path, one sigil per job, and nothing in the query that changes what is addressed.

1. **Path segments are nouns.** Each segment names a thing or a collection. Collections are plural and come from a fixed vocabulary. Acts on a thing are HTTP methods, not segments.
2. **Modes start with `!`.** A mode is a different screen on the same noun. It is always the last segment, and it is the only non-noun a path may hold.
3. **Permission boundaries go in the path.** If two views differ in who may see them or in what they load, they are different paths. The query string only adjusts a screen the viewer is already allowed to see.
4. **A mode names what is shown, never who is looking.** Everyone allowed to open a URL that names a mode gets the same screen. A quiz's bare address names none, and moves to the mode the visitor's role works in: a smith to `!edit`, a reviewer to `!playtest`; anyone not on the hunt stays, and is told to contact its smith for an invitation. (The Coach's choice, 2026-10-05, reversing the hunt_git sprint's thread 1, which moved everyone to `!playtest`.)
5. **Permission comes from the record, not from the URL.** Visibility is decided from the quiz's actual realm and state, before any redirect. A locked quiz looks the same as one that does not exist.
6. **Labels identify; other segments give context.** The quiz label alone finds the quiz. A URL with a stale realm redirects to the current one.
7. **A version applies to everything below it.** `@` sits on the hunt segment, and links followed inside a versioned view keep that version.
8. **Structure characters never appear in labels.** Labels are word characters only, so a URL splits into its parts without a lookup.
9. **One canonical form.** Emit `~`, lowercase labels and literal sigils. Sigils live in the URL template and only labels are interpolated.
10. **URL to file is mechanical.** Drop the `~{org}/{hunt}` prefix and add the resource's pre-extension and `.json` (`Addresses.filepathOf`). A widget, under its scope rather than a hunt, keeps its whole path: `/pub/widgets/dumdum` is `pub/widgets/dumdum.tqw.json`. Every file is listed in `notes/hunt_git.md`, *The index*.

### Sigils

| Sigil   | Where                      | Meaning                     |
| ------- | -------------------------- | --------------------------- |
| `~`     | Start of the first segment | An org follows              |
| `@`     | After the hunt label       | A version follows (FUTURE)  |
| `!`     | Start of the last segment  | A mode follows              |
| `!`     | Right after `@`            | The version is a commit SHA |
| `.json` | End of the last label      | The raw record              |

## Parked

These were explored and set aside until there is something to build.

- **Realm nesting.** Colons inside the realm segment (`alola:gym`), with unlocks going by level. In the export, nested realms would map to nested directories.
- **Saved searches.** Named views such as "ready for review" or "owned by pat" are queries over quizzes, separate from realms.

## URL Characters (why we can't have nice things)

Sixteen non-word characters are legal in a URL path without escaping, and every one of them means something to some other tool.

"Legal" here is the path-segment grammar of RFC 3986, and browsers leave all sixteen alone. They fall into two classes:

- **Unreserved** (`-` `.` `~`): the literal and its `%XX` form are the same URL.
- **Reserved but allowed** (`:` `@` `!` `$` `&` `'` `(` `)` `*` `+` `,` `;` `=`): legal as written, but the literal and its `%XX` form are formally different URLs, so one has to be canonical.

| Char | Problems | `encodeURIComponent` | Our use |
| --- | --- | --- | --- |
| `-` | Reads as a word break, not as structure. Using it as a separator would rule out dashes inside labels for good. A leading dash looks like a command-line option. | leaves | Unused, and not allowed in labels |
| `.` | `.` and `..` segments are path navigation and get resolved away. Middleware and CDN rules often treat any path with a dot as a static file. A trailing `.xyz` reads as a format. A leading dot hides a file on Unix. | leaves | `.json` suffix for the raw record |
| `~` | Shells expand it at the start of a word: `~pat` alone is pat's home directory. Buried on phone keyboards and missing from some layouts, such as Italian. Older encoders emit `%7E`. Reads as "user" mainly to people with a Unix background. | leaves | Org sigil |
| `:` | A relative link whose first segment holds one parses as a URL scheme. Forbidden in Windows filenames, where it can silently create an alternate data stream. Shown as `/` by macOS Finder and rejected by FAT and exFAT. `scp` and Docker read it as their own separator. Marks parameters in Express-style route patterns. Collides with `field:value` search syntax, YAML and CSS selectors. | escapes | Unused; parked for realm nesting |
| `@` | Delimits user info before the host, so scanners distrust it: `https://bank.example@evil.example/`. A folder starting with `@` is parallel-route slot syntax in the Next.js app router. Outside a full URL, `@name` reads as a mention and `a@b` as an email address. | escapes | Version marker on the hunt; possible alias for `~` |
| `!` | Interactive bash and zsh run history expansion on it unless it is single-quoted: "event not found", or a previous command substituted in. Reserved by some route-pattern syntaxes. | leaves | Mode sigil; SHA marker after `@` |
| `$` | Shells expand `$name` as a variable, and an unset one becomes nothing, silently giving a different valid URL. Regex end anchor. Special in JavaScript replacement strings (`$1`, `$&`) and template literals. Marks parameters in some file-based routers. | escapes | Unused; rejected for versions |
| `&` | Unquoted in a shell, it backgrounds the command and cuts the URL short. Query-string separator, so it misleads readers and log parsers. In HTML it must be written `&amp;`, or `&copy` in text shows as ©. | escapes | Unused |
| `'` | Ends a single-quoted shell string, the very quoting that protects `!` and `$`. String delimiter in JavaScript, SQL and HTML attributes, so filters flag it as injection. Autocorrect turns it into a curly quote. | leaves | Unused |
| `(` `)` | Markdown links are `[text](url)`, so a parenthesis in the URL ends the link early in many renderers. Syntax errors in an unquoted shell command. Group syntax in regex and route patterns. | leaves | Unused |
| `*` | Shell glob: it expands to matching filenames, or errors in zsh when nothing matches. The wildcard in route patterns, CORS rules, robots.txt and glob config, so a literal one is hard to express. Markdown emphasis. Forbidden in Windows filenames. | leaves | Unused |
| `+` | Means a space in form encoding, and some servers apply that to paths too, so `a+b` can arrive as `a b`. Regex quantifier and route-pattern modifier. | escapes | Unused |
| `,` | List separator in CSV, in HTTP headers and in `srcset`, so a URL holding one needs quoting there. | escapes | Unused |
| `;` | Ends a shell command, and what follows runs as a new one. Some servers strip `;...` from a segment as a path parameter (`;jsessionid`), and a proxy that disagrees opens access-control holes. Separator in headers and cookies. | escapes | Unused |
| `=` | Key-value separator in queries and cookies, so a segment holding one reads as a parameter to people and to log parsers. | escapes | Unused |

That leaves `~`, `@`, `!` and `.` in use, each with one job, and `:` parked.

A few problems cut across the whole table:

- **Shells.** `!` `$` `&` `;` `*` `(` `)` and `'` are all shell syntax, so single-quote any URL typed at a prompt.
- **Trailing punctuation.** Chat and mail linkifiers drop a trailing `.` `,` `;` `:` `!` `'` or `)` from a pasted URL, so no URL should end in one.
- **Encoding helpers.** Passing a sigil through `encodeURIComponent` gives the `%XX` form for half the table. Keep sigils in the template.
- **The structural pair.** `/` separates segments and `%` starts an escape. An encoded slash (`%2F`) inside a segment is decoded, rejected or passed through depending on the server.
- **Everything else.** Space, quotes, angle brackets, square and curly brackets, `#`, `?`, `^`, pipe, backslash and backtick must be percent-encoded. Browsers also rewrite a backslash to `/`.
- **Even the underscore.** The one word character that is not a letter or digit disappears under a link underline.
