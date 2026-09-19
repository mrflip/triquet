---
paths:
  - "**/relics/**"
---

**IMPORTANT: ONLY USE RELICS IF YOU ARE TOLD WE WILL BE WORKING WITH A RELIC**
**IF YOU ARE NOT TOLD WHAT SPECIFIC SUBDIRECTORY OF /relics TO USE, STOP AND ASK**

We will use items in `/relics` to bring in code coming from other codebases.
That code is often old, or may have been done by someone making every decision differently than our approach, could plausibly be a copy-paste from the drunkest worst AI coder that ever gave codebro advice. Be cautious of their organization or naming or implementation.

You are not being asked to "port" the code. You are trying to capture their intent, and recapitulate that in code matching the approach of this repo. Use good judgement about where to look at it as code to translate and where to consider it a requirements document

You should also regard unit tests in relics with caution, but give more respect to their organization and to the exact inputs, title, tests, and messages. They probably will be in jest+chai -- port them to vitest.

## Process

Follow these steps:

### Epoch I: Test planning

The coach will outline these things; stop and ask for them if they didn't:

1. what subdirectory of relics we will use; consider that the label for this work thread
2. The intent of the exercise
3. What parts of the implementation to trust
4. What parts not to trust
5. Changes in contract
6. Proposed phases to work in

Claude will:

1. Reply in chat, "I see the `relics.md` instructions, let's make old things new again!"
2. Make a file in whiteboard named for the subdirectory of relics we are working on (eg `whiteboard/validation.md` for porting the old validation frameworkl). Use this to surface information that you put in chat and anything longer worth communicating. If you want to, make files in `whiteboard/{reliclabel}/whatever.fext`. As always, do not put notes about our process into the code itself. You will not use HUMAN-* files when working in relics -- use the `whiteboard/{reliclabel}.md` file
3. Read through the test files. Identify where the tests would benefit from mocks or other advanced capabilities. Give it the kind of implementation code review you would if your nephew who works somewhere else asked you for one: "this feels like a lot of work for little gain", "there's an easier way to do this", "what does this even do" -- not a list of nitpicks or bad habits or violations of our style guide.
4. Confirm exactly what tests, if any, should be modified, and how
   - The coach may have indicated things they want to change about the codebase. Identify tests that should be changed in consequence
   - Identify places that the tests seem to enforce behavior at odds with the coach's proposal, or with the codebase or conventions -- this is a place where your skills will be especially valuable.
5. Make a file, `whiteboard/{reliclabel}/testplan.md` similar to this: (`//! means this is my comment to you about the following sketch:)

```
For each chunk of code, the files and their corresponding tests will be brought over in two phases:

1. light-touch transfer of everything as if we honored the old contract directly: mostly just translating to vite and adjusting import names, etc.
  - git commit to capture the infomercial's "before" photo
2. Execute changes to the meaning and mechanics of the tests, described below
  - git commit to capture the infomercial's "after" photo
3. (described elsewhere) -- transfer and modify code for these tests

## LGTM

Claude will translate directly the mechanics of everything in thisfile, thatfile, most things in theotherfile, and the following:
* winkum.test.js: 'rocket priming sequence', 'launch abort'/'blah'...'blahteyblah' but not 'foo' //! those are describe blocks/tests

In phase 2, Claude will apply style corrections to the titles but otherwise those tests look good

## Changes to match contract:

In phase 2, will alter title and tests to enforce:

* launching now requires two confirmations. Will update fileA and parts of fileB and fileC
* No more convertible mode; astronauts must close all windows before launch. Will update yolo/*.test.ts

## Better practices

* In phase 2, Will modify the files in '...' to use mock {...}s

## Conflicts with directives or conventions.

In phase 2, will alter title and tests to enforce:

* We don't write our test titles in pig latin any more. That will change the title, but not the content, of everything in `oloyay`
* The tests indicate that helmets are not required on Casual Fridays. This is at odds with our safety standards. Claude proposes inverting these tests to specifically verify helmet requirements on selected future Fridays using a mock Date function.

* a number of the tests in abortsequence/rookie.test.ts have classic errors: testing the framework, not the function; redundant tests; vacuous examples. Also, everything under 'the abort sequence works' is commented out. Claude propose bringing none of it over right now. In phase one, we will make a file `abortsequence/rookie.test.ts` in the new codebase with a single failing test 'abortsequence/rookie.test.ts from relics needs review' to enforce that it is eventually brought over

## Removed before transfer:

* The code in (...) looks like it's specific to the other codebase or to unimplemented functionality here. Claude intends put those parts of those files into `whiteboard/{reliclabel}/(same path and filename as in relics/{reliclabel})` and otherwise abandon them

* As directed, everything to do with the CPM-80 operating system will be left behind.
```

Complete that file, do a git commit and report highlights to the coach. **Unless directed, no other code changes are made in this Epoch**

### Epoch II: Code Planning (WIP)

The last step reviewed the whole test suite. If the code we're porting is large or can be decoupled for this and the following epochs we will proceed in "waves". For example, on the validators expedition we had to create a shim utility function that depended on a node feature, and then make the error reporter emit the same messages so that the tests of failed validations worked, etc. Each of those waves went in phases of plan, migrate tests to the new platform matching intent, committing, modifying tests according to the plan, committing, then the same with the code.

We'll discuss what Claude learned in Epoch I, refine the waves, and then Claude will start bringing over tests, applying the plan from Epoch I, and migrating or writing code to make them pass

### Epoch III

**DO NOT make changes that break tests and then "fix" the tests in response to the new behavior**. Tests should only change after we have discussed and both approved the new contract. Make the fixes as you believe a fix is appropriate, or hold off, but leave the test broken and we'll discuss

#### Autofixes

* Missing jsdocs, jsdocs missing @returns that are non-trivial, jsdocs with the @params and the name and the type in the wrong order, other solecisms: fix as you go
* Typescript errors newly appeared? Very good chance the code was from a repo with legacy tsconfig. If the fix is easy and obvious and doesn't change the contract, fix it.
  - do NOT make changes that break tests and then "fix" the tests to the new behavior
* Name changes that are obvious repairs to meet the style guide (eg variable named `obj` where it's a `clxn`)? You're approved to update the function and its tests.

Example:

```ts
// BAD: no docblock, single-letter identifiers, no return type, all the rookie TS mistakes, and it doesn't do what it says (returns an array given a bag)
   function scrubNil<T extends array>(obj: T): T
   function scrubNil<T>(obj: Bag<T>): Bag<T>
   function scrubNil<T>(obj: array|Bag<T>) {
     return _.reject(obj, _.isNil)
   }

// BETTER:
  /** Collection without its nil values: gone from an array, unset in a bag or object */
  export function scrubNil<CT extends object>(clxn: CT): Scrubbed<CT> {
    const scrubbed = Array.isArray(clxn)
      ? clxn.filter((val: unknown) => val !== null && val !== undefined)
      : omitBy(clxn, (val: unknown) => val === null || val === undefined)
    return scrubbed as Scrubbed<CT>
  }
  // if there were no tests for the "given a bag return a bag" (which would have been failing) -- create them, report in chat
  // if there were tests proving that given a bag it returns an array (contradicting the common sense of the method and its docblock) -- leave them failing, do not change them, raise it on whiteboard and in chat.
```

### Typescript

The old code will have a lot of issues with typescript. Autofix.
* Missing? add it
* extra overloads that don't match the implementation? Remove or fix
* Generics used in a way that's bad practice? Fix
* other rookie errors? most likely
If in doubt, err on the side of being more informative and more restrictive -- if customers of the function grow errors then discuss

#### Dangling References

The code will almost certainly make references to other parts of its original codebase.

Often it's something obvious -- `ContactHelpers.normalizePhonenumber`, or `Filer.basenameFor`, we have no module called that, and it's a perfectly cromulent thing to do.
* Make that file, and add the barest-bones thing there, or perhaps a stub throwing a NotYet error (which we don't have yet, hah!).
* Don't add to the package.json (yet). Don't implement anything complicated. Do assume, for the moment, the implied contract is sound. Do follow our style rules for naming and the like
* Surface the stubs you create in chat. Make a recommendation for how to implement it and at what depth -- coach probably has test files for you to work from.

Sometimes it's not clear what that particular thing is doing, but everything else is making sense. Make a stub with an error

Sometimes you will see evidence that this part of the code will not be useable unless a great deal more code is brought over. Stop and discuss

Decent chance you will see portions of the files have code that either belong to the other workspace, or pertain to features that don't exist yet and were not mentioned in the chat.
Abandon those files or parts of files and surface it in chat.

#### Archaisms

* calls to zodchecker.cast -> .parse; .report -> parseSafely.
*
