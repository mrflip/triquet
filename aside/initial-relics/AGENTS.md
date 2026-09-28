# Stack

This project follows an Agent-Coach approach. Experienced human architects are the Coaches,
with you (the AI agent) developing the code: two equally important roles. Coaches want pushback
where warranted, and encourage you to think independently, governed by the guardrails outlined
here.

## Philosophy and Values

The top three values while writing code are empathy, safety and readability. U

When suggesting toolkits, we don't want anything still being proven, but I'm happy to move
with the front of the crowd as soon as it's clear that will have the best long-term relevance.
Developer ergonomics are important.

Be very wary of home-brewed solutions. If you find yourself writing a lot of code to solve a problem,
or banging rocks together instead of calling a toolkit entrypoint, there's a good chance we've
misdirected you or that we're solving the wrong problem. Unless we demonstrate
that something is slow, prefer maintainability and legibility over performance. Cleverness is
rarely called for (but if it seems to be, propose it).
Do not ever treat secret keys or other sensitive data with imaginative code: use best practices and libraries.

## Best Practices

Every new piece of code should have a proportional doc block and test suite.
The crucial details, and what "proportional" means are described below.

Module entrypoints should apply strict validation and, if complex, purely that and then orchestrate other methods. These are strict but fair, smooth managers. These functions are encouraged to offer elegant, convenient, generous interfaces: pass a string, or strings, or undefined if you don't care, we'll find a sensible default. We're here to serve, the function says. After zod has done its thing, there's no ambiguity, no undefined-checking paranoia.
After that point, write code that is focused on the task, confident it has clean meaningful data. Short, single-concern stanzas.

### Documentation and Comments

**Do not use doc blocks or code comments for progress/development notes, for detailed caveats or information dumps, or anything else that will become irrelevant later.** Instead, use HUMAN-whatsup.md like a working-group's whiteboard, or a file in this repo's /notes folder whenever that seems more suitable.

Write code in proportion to how much it will be used, and how much there is to say. Always supply at least one fragment, on the very first line of the comment. Since it will still appear even if "folded" in the IDE: `/** Description, continuing on following lines, but line-break'ed so the essentials are` -- IUCWIDT. See STYLE.md for more on doc block styling

#### Comments

Legible code written with short functions having strong contracts should rarely require running comments. Too often a running comment either...
1. ...narrates what the code already does, or what the agent was thinking at the time. BAD:`// next, concat the foo and the bar and trim whitespace ...`. PERFECT: `_.trim(foo + bar)` -- the code speaks for itself.
2. ...reflects poor name choices. BAD: `process(node) // calculate the current node's degree`. BETTER: `degreeFor(currentNode)`
3. ...delimits code that should instead be in short, separate, testable function. BAD:  `// next, calculate the foo, which should be less than 10\n(...lines to calculate the foo...)`. BETTER: ` calculateFoo(...)` -- a documented function with tests, not comments, enforcing its contract

Code documentation must focus on serving the caller of that code. Code cleanliness and strong tests are sufficient to serve current and future authors.

### Tests

Methods with an external must have at least one test demonstrating each use case. Every `@example` in a doc block must have a corresponding test

```ts
describe('padEnd', () => {
  it('returns a string with at least the requested length', () => {
    expect(padEnd("hello", 8)).to.eq('hello   ')
  })
  it('allows you to supply the padding character', () => {
    expect(padEnd("hello", 8, '_')).to.eq('hello___')
  })
})
```

At whatever point the shape of the test function becomes duplicative,
bulk-test against example lists (including every example from the docs
and those long-form tests), written in this style

```ts
const PadTestCases = [
  // regular usage:
  [["hello world", 0],            "hello world",         'string, maxLength zero, default padding: returns input'],
  [["hello world", 10],           "hello world",         'string, maxLength less than its own: returns input'],
  [["hello world", 11],           "hello world",         'string, maxLength equal to its own: returns input'],
  [["hello world", 12],           "hello world ",        'string, maxLength one more than its own, default padding: adds one space'],
  // ... more ...
  // trivial cases:
  [["", 0],                       "",                    'empty string, length: 0, default padding: returns input'],
  // ...
  // ... weird cases ...
  [["L'Iñtërnâtiôñàlizætiøñ.𝍔", 20], "L'Iñtërnâtiôñàlizætiøñ.𝍔", 'Unicode characters retain fidelity'],
  [["L'Iñtërnâtiôñàlizætiøñ.𝍔", 26], "L'Iñtërnâtiôñàlizætiøñ.𝍔 ", 'Padding counts by character, not byte'],
  // ...
]
```

Do not go crazy with duplicated examples: each one should tie to a plausible failure mode. In particular, address:

* what does an exists-as-undefined, or a null, value mean?
* what does a missing value mean?
* what do we do about nil/missing elements?
* what do we do about cardinality mismatches (`filter(1, iteratee)`)?
* what do we do about type mismatches that are absurd (`toInteger("three")`, `toInteger([])`)"?
* what do we do about mismatches that aren't *patently* absurd -- `nth(arr, "1")`, `nth(arr, 1.5)`, `nth(arr, -1)`, `nth(arr, inf)`, `nth(arr, MAX_SAFE_INTEGER + 99)`?

### Other

* We enjoy convenience but will not tolerate ambiguity
* We're comfortable saying "clean data will be clean, unclean data will be yolo" -- sanitize data at a high-level entrypoint, then write code without paranoia of absurd data; let the system or visual feedback be the policeman. If `undefined` is a perfectly reasonable way to communicate "do the right thing here", do the right thing.

## Stack / Colophon

As called for, choose these libraries:

* Next.js
* es-toolkit/compat
* Zod 4
* Visual library: Material UI
* Vitest with chai validators

To any extent reasonable, prefer to author content in markdown rather than HTML.