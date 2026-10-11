# Thread 7: google_pages (2026-10-11)

Branch `20261011-google_pages`, PR filed at landing; see the report. Suites at `ready`: justify
green (203 unit files, 5932 tests); e2e smoke tier 31/31, and `brand` with the new `policies`
spec 16/16, on lane 4. Not yet proved (`pnpm e2e`): the root layout changed, so `--touched`
reaches the whole suite.

* **Built**:
  - `/privacy` and `/terms` (`src/app/privacy/`, `src/app/terms/`), outside `(synced)`, from
    markdown in `src/content/privacy.md` and `terms.md`. `next build` lists both, and `/about`,
    as static (prerendered). No Convex client stands in front of them (an e2e test closes the
    database's socket and reads them).
  - `src/content/about.md` rewritten: what Triquet is and does in its first paragraph, then
    sign-in, and links to the policy, the terms and `info@triquet.me`.
  - `ProsePage` (`src/components/ProsePage.tsx`): a page of prose, its title the one heading. About
    uses it now, beside the two new pages.
  - `SiteFooter` (`src/components/SiteFooter.tsx`) in the root layout: About, Privacy, Terms and
    `info@triquet.me` on every page. Its `ContactAddress` is the one spelling of the address in
    code; the markdown's tests hold the pages to it. The layout is now a column at least the
    window's height, so the footer sits at the foot of a short page.
  - `src/mdx-components.tsx` dresses headings, lists and links too (an app path goes through
    `NextLink`). The Full History dialog's lists pick this up.
  - `Routes.privacyPath()` and `Routes.termsPath()`: the stable paths thread 6 links.
  - Tests: `tests/content/{about,privacy,terms}.test.ts`, `tests/components/SiteFooter.test.tsx`,
    routes; e2e `e2e/policies.spec.ts` (new, in `SpecCorners` as *the policies*, with
    `ProsePage` and `mdx-components` in *the pages of prose*) and a test in `brand.spec.ts`.
  - `google-oauth-keys.md`: *The branding page, field by field*, the exact URLs
    (`https://triquet.vercel.app/about`, `/privacy`, `/terms`).
  - `notes/security.md`: the policy recorded as a public statement code must keep true.
  - `whiteboard/TODO.md`: deletion by request has no command yet.
  - `human/20261011-google_pages.md`: the Coach's approval asked, with the points to look at.
* **Decisions taken**:
  - **True now and later.** The pages land in the first merge step, before Google sign-in exists,
    so every Google claim is conditional ("If you sign in with Google ..."). Nothing on the page
    says it describes a future app; nothing on it is false today.
  - **No `dynamic` route config.** The three pages are static by default, and `dynamic` belongs to
    Next 16's older caching model. The build's route table is the check.
  - **Prose in `ProsePage`, not `Typography` in each page**, and the date as the markdown's first
    line, which a test parses.
  - **`SiteFooter` and the root layout stay out of `SpecCorners`**: on every page, a change there
    reaches the whole suite.
  - **"Title" on screen is "name"**, as the front door says it ("the name you give beside it").
* **Discoveries**:
  - A visitor opening a hunt's address while not on it is told its smiths' names and handles
    (`hunts:open`, `NotOnHunt`); the policy says so. Thread 9 may want to look at it.
  - A bot's malformed answer is logged on Vercel (its first 600 characters) by `/api/ask`; the
    policy's "logs of requests and errors" covers it.
  - Convex Auth 0.0.96 stores no Google access or refresh token, only the profile and, on the
    account row, the verified email: the basis of "Triquet cannot read your mail".
  - Production is `triquet.vercel.app` (`notes/20260928-cloud_measurements-a.md`); the
    production Convex host is recorded nowhere in the repo.
* **For the Coach**: approve the wording (`human/20261011-google_pages.md` lists what to check).
  Claims resting on later threads: Google's email, name, picture and `sub`, and nothing more
  (thread 5, which must ask for `openid email profile` only); an email shown to its owner alone
  (thread 6, checked by 9); "handle" on screen (thread 1).
