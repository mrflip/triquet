# Trivia Ambiguity Audit — standalone export

This is the extracted source behind the "Trivia Ambiguity Audit" Claude artifact
(https://claude.ai/code/artifact/8e0def73-39ad-4b84-a0c4-eaac38aa7a66), packaged
as an ordinary local project.

## What this is

`index.html` is the *entire* app — HTML, CSS, and JS all in one file, plus the
current quiz data baked in as `window.__INITIAL_STATE__`. There's no build
step and no server-side code. It's just a static page.

Two things it loads from a CDN at runtime:

- lodash (`cdnjs.cloudflare.com`)
- the Zilla Slab / Work Sans / JetBrains Mono fonts (`fonts.googleapis.com`)

Everything else — including a full copy of Zod v3, self-bundled as an
inline IIFE — is already in the file. If you need it to work fully offline,
vendor those two in and rewrite the two `<script src>` / `<link>` tags to
point at local copies.

## The one feature that won't work outside claude.ai

The "ask Claude" behavior in the guess/numberish cells calls
`window.claude.use("sample")`. That's a capability the claude.ai artifact
host injects into the page's `window` object — it doesn't exist in a plain
browser tab or a generic web project. Outside claude.ai, `capabilityInit`
resolves to `null`, `sampleAPI` stays unset, and those "ask" buttons quietly
do nothing (see the bottom of `index.html`, around the `// ---------- boot
----------` comment).

Everything else is fully portable: the quiz state loads from and saves to
this browser's own `localStorage` (key `trivia-audit-state`), independent of
claude.ai.

If you want those buttons working in a standalone build, there are two real
paths:

1. **Call the Anthropic API directly.** Replace the `sampleAPI.*` call
   sites with `fetch()` calls to the Messages API, using your own API key.
   A browser page can't hold a secret key safely, so this really wants a
   thin backend (even a 20-line one) to proxy the request — or you run it
   locally only, out of a `.env` you don't commit, understanding the key is
   exposed to anyone who opens dev tools.
2. **Leave them as no-ops / hide them** in the standalone build, and keep
   using the hosted claude.ai artifact whenever you actually want the AI
   grading — treating this export as a version-controlled, offline-editable
   copy of everything else (the table, the data, the layout).

I can do either one if you want — it's a contained change localized to the
`sampleAPI` call sites.

## Running it

No install needed:

```
open index.html          # macOS
xdg-open index.html      # Linux
# or just double-click it
```

Or serve it (some browsers restrict `fetch`/CDN loads from a `file://` URL):

```
npx http-server .
```

## Why there's no "git repo" to export

Claude artifacts aren't backed by a git repository — the artifact service
stores and versions the page's own HTML/files internally, not as commits.
So there's nothing to `git clone` from claude.ai's side. What you *can* do
(and what this export is) is pull the actual source out and start your own
repo with it — which is what's set up here (`git init` + an initial commit),
so from this point on you have normal git history for whatever you change.

## Making it a real Claude Code project

This folder is already a self-contained repo. Open it in Claude Code
(`claude` in this directory) and it's a normal project: edit `index.html`
directly, or split it into separate `.css`/`.js` files first if you'd
rather work that way (nothing about the app requires it to be a single
file — that's just how claude.ai artifacts are structured).
