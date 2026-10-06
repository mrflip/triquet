# Triquet's tab-separated formats

Oct 5, 2026 · @Philip F Kromer

Two tab-separated formats leave the app: the **tables of a hunt's files** (every `.tsv` in a
hunt's history, and in its download) and **Copy for Sheets**. Nothing reads either back in
today.

## What a table is for

A hunt's JSON files are the archival format: complete, typed, and what the deep merge reads. A
table beside each one is **a convenient way to round-trip spreadsheet data**: legible in a diff,
pasteable into a spreadsheet, and reversible given the field's type. It is not a second archive,
and it does not try to say a cell's type on its own.

## The hunt files' tables (`Tsv`, `src/lib/tsv.ts`)

Every `.tsv` beside a `.json` ball follows one set of rules, even where that is silly for a
single record:

* **One header row**, of column names in code-unit order, then **one row per item**, in
  code-unit order of `label`. A single record (the hunt, a quiz, a widget) is one row. Every
  table has a `label` column: the key, for a collection's members; the thing's own label for a
  single record. Where order matters, the item's `position` is a column like any other.
* **Columns expand a bag down to the level whose type we control.** A bag whose keys and value
  types our own schema fixes, and which is not a union, opens into dotted columns: a quiz's
  `columns.title.width_px`; a question's `dumdum.status` and `dumdum.value`. Below that, a value
  whose shape we don't fix, or which is a union, is **one cell of JSON**: a widgeting's `value`
  (whatever its widget answered), a widgeting's `params`, a widget's `config` (its shape
  depends on its formulary). No prefix is added to anything: a question's own fields are
  `clueing`, `qnum`, not `question.clueing`.
* **An empty bag has nothing to open into**, so it is one cell, `{}`: a quiz with no widgetings
  writes `widgetings` so.
* **A header name is escaped as a string cell is**, so no key can break the header row.
* As built: `Tsv.textOf` writes every table, and `Huntfiles`' `WholesFor` names, per kind of
  table, where a value is one cell of JSON.

### A cell, by the field's type

| Type | Written as | Example |
|---|---|---|
| number | its decimal text, never escaped | `40`, `0.5`, `1e+21` |
| boolean | `true` or `false` | `true` |
| string | as JSON would encode it, but **without the enclosing quotes and without escaping `"`** | `Leon's "big" day\nsecond line` |
| list, or a bag we don't expand | compact JSON, as is | `[{"kind":"numeral","text":"300","value":300}]` |
| null, missing, or empty string | an empty cell | |

* **A string escapes only backslash and the invisible characters**: `\\`, `\t`, `\n`, `\r`,
  and any other control character as JSON writes it (`\b`, `\f`, `\u0001`). The text fields a
  person types can hold no control character but tab and line breaks (`TextishRe`), so in
  practice a cell holds at most `\t`, `\n`, `\r` and `\\`. Everything else, `"` and non-ASCII
  included, is written as itself. A string cell is always one line, and reverses exactly.
* **A JSON cell is not escaped again.** Compact JSON holds no raw tab or line break, so it is
  one line as it stands, and `JSON.parse` reads it back unchanged.
* **A number is never escaped**, so a number column matches a numeric pattern throughout, blank
  cells aside.

### What a cell can't say on its own

Reading a cell back takes the field's type, which the schema (and the JSON beside the table)
holds:

* **null, a missing field and an empty string are all an empty cell.**
* A string that happens to read as a number, as `true`, or as JSON looks the same as one; only
  the field's type tells them apart. Guessing it from the text would be slightly ambiguous.
* A string cell's `\n` is two characters in the file and one line break in the text.

To unflatten a string column in a spreadsheet, with the cell in `A2`:

```
=SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(A2,"\\",CHAR(1)),"\n",CHAR(10)),"\t",CHAR(9)),"\r",CHAR(13)),CHAR(1),"\")
```

The backslash goes to a placeholder first, so that `\\n` (a backslash, then an `n`) is not read
as a line break. `CHAR(1)` is safe as the placeholder because typed text can't contain it. The
rare `\b`, `\f` and `\u00XX` of a non-typed string are left as written.

### Why not JSON-encode every cell

It would make every cell's type certain (short of mistyped data that is still valid JSON). But
it would put every string in quotes and double each `"`. Questions quote things constantly, so
those would be the most common escapes in the file. Every string cell would then need parsing
before use, and re-encoding after each trip through a spreadsheet. The JSON file is already the
archival format with types; the table exists for convenience, and a long, sometimes multi-line
text flattened onto one line is usually a convenience in its own right.

## Copy for Sheets (`sheetsExport`, `src/lib/sheets.ts`)

What the quiz's gear copies, to paste into a spreadsheet: **lossy, made for a paste, not for
reading back**.

* Its columns are the grid's own (what each column shows, by its label), ordered by header
  label, so reordering the grid moves nothing in the paste.
* Its rows are the questions **in rank order**, whatever the grid is sorted or dragged into.
* A cell is the text the grid shows. A line break becomes a literal `<br/>`, which also
  survives into a rich-text cell; a tab becomes a space (`pasteSafe`). Neither reverses.
