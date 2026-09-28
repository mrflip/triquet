


## Add label

I've got a bunch of things to sort through, that was a marathon! Everything's working well that I can see though!

Tackle these in chunks as you judge, making commits as you re-land at green test milestones.

Quickies:

ModelTier should default to quick, if it isn't

writer mode column heads should sit at the bottom of their cell (aligned right if I turn my head)

Global change:

Please access `es-toolkit/compat` by doing a blanket import under the name `_` -- as if we're still doing lodash; so: `_.map(...)`. Add instructions to that effect in STYLE.md.

Name changes:

We are going to be renaming some fields and making data model changes. This will break importing. That is OK for now, there's nothing to import (and tsv solves most of that if needed)

1. rename everywhere "short answer" to "title"; make it the leftmost column.
2. A quiz should be called a quiz, everywhere: no "round", in variable names or content. Change "Trivia Round" or "Trivia Quiz" to simply "Quiz"
3. `ii` is a loop iterator, only to be used for local for-ii-... contexts. The style guide was unclear on that, I apologize. Review where it's being used; array indexes are `idx` when generic. `fields of the line at \`ii\`` is better written as `fields of the line at \`lineIdx\``.

---

People will want to cycle the data through other tools and round-trip it back in. even with ulids, it is much more convenient to have it hand-editable. This is a casual tool and can tolerate foot-shooting like duplicating all the questions or even clobbering them -- but we must never allow loss of referential integrity

1. install unique names generator.
2. Make a module, LabelMaker with
   - `localBlankLabel(existingLabels, fallback)` method to generate a new adjective-animal label, check against existingLabels, re-rolling, and returning the whole fallback (youll pass it the ulid) after too many re-rolling fails.
   - `appendFallback(str, fallback?) { return str + '_' + ULID.monotonic() }`
   - `normalize(str, { maxlen? })` returns '' given blank string; otherwise does deburr, lower case, `/[_\W]+/` replaced with `_`. prepend a `z` if it does not start with a letter, and remove trailing '_'. Append 'z' if it is shorter than two characters. validate and return.
   - `titleize(label)` _.titleCase's the label
   - `urlize(label)` under_scores the label
   - `display(label)` kebab-cases it
2a. do a good job with the testing Cases for the non-trivial handle maker functions (i.e. the ones that aren't delegating to `_`). `__` => `zz`, `a__b` => `ab`, ` 9 ` => `z9`, `éü` => `eu`. Test against the internationalization test string, and emojis

--

1. Add a "label" field for question and quiz, and generate one such at creation. Also add `forced_label` nullable, default null. Populate the title from the label when one is blank and the other isn't. (Don't write any code yet for updating the label, even though it's obvious that's coming)
2. Add a `label` zod validator enforcing  `^([a-z][a-z0-9_]*[a-z0-9])$` to validator
3. Display a question's label below its title in quiet style. Don't add an explicit display of the quiz label (it's about to be in the url)

--

Make the quiz label be its route, and have that be in the url as `/my/quiz/#quiz_label`. Have `/` route to the first quiz if any or a new quiz if not.

Add a gear icon next to the quiz title, opening a modal container for two separate views -- for managing this quiz (top part) and all quizzes (bottom part). in manage quiz, you can edit the label and hit save. Make sure neither the smith, the router, or the url are confused by this flavor of atomic change of the quiz label.

--

Lastly:

> Descending chain order roots at the highest Q#. §M3 says every restart roots at the lowest, in both directions — but taken literally, walking 1→2→3→4 backwards gives you 1,2,3,4, which contradicts that milestone's own "flip it and read it backward"

I think that if there are conflicts (many pointing to the same node), they resolve differently. I ¿think? there's three things that we can interpret as "flip" that are different, or at least when there's a degeneracy: 1) use the reverse direction to toposort; 2) BFS vs DFS I think? 3) just reversing the topo list. In every case adding disconnected components at the end. Since I'm interested in making a chain, (3) isn't very interesting, the other two might be? Can you make it do (1), I'll tell you if it's useful.
If you're not seeing the difference in them, bail out, it's not worth a ton of work as it only matters when the chain is weird.