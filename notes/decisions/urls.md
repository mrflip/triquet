# Triquet URL Scheme

Oct 5, 2026 · @Philip F Kromer

## Scheme

Every URL is an org, a hunt with an optional version, a path of nouns, and an optional mode.
(Org, at current, means the ident label)

```
/~{org}                                      an org's hunts
/~{org}/{hunt}                               hunt home
/~{org}/{hunt}/quizzes                       all quizzes
/~{org}/{hunt}/quizzes/home/{quiz}           a quiz
/~{org}/{hunt}/quizzes/home/{quiz}.json      its raw record (future)
/~{org}/{hunt}/quizzes/home/{quiz}/!{mode}   !edit, !playtest, !{view}
/~{org}/{hunt}/images/{image}                shared images
/~{org}/{hunt}/categories/{category}         difficulty categories
/lib/widgets/{widget}                        construction widgets
```

Example: `/~pat/spring_hunt@go_live/quizzes/home/legends/!playtest` (note: includes future proposals)

| Part                  | In the example | Meaning                                          |
| --------------------- | -------------- | ------------------------------------------------ |
| `~{org}`              | `~pat`         | The org that owns the hunt                       |
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
* As built: `notes/hunt_git.md` is the index of every file, its shape and its table

## Decisions

The database is the system of record, and the URL names things by label within an org and a hunt.

| Topic              | Decision                                                                                                                      | Reason                                                                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Orgs               | `~{org}` is the top-level scope. Every username is its own org.                                                               | Hunt names are chosen within an org, not guessed against a global namespace. The sigil keeps the root free for the app's own routes.     |
| Org sigil          | Only `~` is emitted.                                                 | `~` is the one sigil that never needs encoding. The alias covers keyboards that lack it.                                                 |
| Labels             | Every label matches `/^[a-z](_?[a-z0-9])+$/`.                                                                                 | Lowercase only, so no case collisions. At least two characters, single underscores, and a linear-time match.                             |
| quizzes            | A quiz label is unique across its hunt.                                                                                       | A bare label always identifies one quiz, so references survive a move.                                                                   |
| Realms             | One realm, `home`, its own label. Its slot stays in the path. (Sketched as `a`, which the label rule refuses: the hunt_git sprint's Decision 1.) | The URL shape will not change when realms return.                                                                                        |
| Modes              | A trailing `!{mode}` segment: `!edit`, `!playtest`, or a user-created `!{view}`. Built-in names are reserved from user views. | Modes get their own namespace and cannot collide with a noun.                                                                            |
| Versions           | `{hunt}@{ref}` for a named ref, `{hunt}@!{sha}` for a commit. Named refs follow the label rule.                               | A version names the state of the whole hunt, so every link below it stays in that version. The `!` keeps a tag from being read as a SHA. |
| Hunt resources     | `images/`, `widgets/` and `categories/` sit beside `quizzes/`.                                                                | One fixed vocabulary of collections under the hunt.                                                                                      |
| Raw record         | Adding `.json` to a quiz URL serves the record itself.                                                                        | The same address gives the app view and the data.                                                                                        |
| Query and fragment | The query string adjusts the screen being shown (filter, sort). The fragment marks a position within a quiz.                  | Neither one changes which thing is addressed.                                                                                            |

### Git export

The in-browser git repo is ancillary to the database: an export format with superpowers, kept because diffing back is so valuable.

- **One repo per hunt.** `~{org}/{hunt}` is the repo's address, so transferring a hunt renames a repo and leaves its contents alone.
- **URLs map to files.** `/~{org}/{hunt}/quizzes/home/{quiz}` is `quizzes/home/{quiz}.tqq.json` inside that repo.
- **Records only.** Results and media binaries stay out of the repo.

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
10. **URL to file is mechanical.** Drop the `~{org}/{hunt}` prefix and add the resource's pre-extension and `.json` (`Addresses.filepathOf`).

### Sigils

| Sigil   | Where                      | Meaning                     |
| ------- | -------------------------- | --------------------------- |
| `~`     | Start of the first segment | An org follows              |
| `@`     | After the hunt label       | A version follows (FUTURE)  |
| `!`     | Start of the last segment  | A mode follows              |
| `!`     | Right after `@`            | The version is a commit SHA |
| `.json` | End of a quiz label        | The raw record              |

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
