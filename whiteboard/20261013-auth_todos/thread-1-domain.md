# Thread 1: The domain is triquet.me (2026-10-13)

Branch `20261013-domain`, PR filed at landing; see the report. Suites: justify green (typecheck,
lint, 6461 unit tests).

* **Built**: every live mention of `triquet.vercel.app` now reads `triquet.me`:
  - `convex/auth.ts`, `returnUrlFor`'s three `@example`s (doc block only; its tests stub
    `SITE_URL` as `http://localhost:3099` and are unchanged);
  - `.claude/skills/pullchef/SKILL.md`, production's `stats.json` and `/stats` (five mentions);
  - `scripts/measure-latency.ts`, the usage line for a cloud run;
  - `notes/deploy.md` now names production's address beside `SITE_URL` (*Convex* bullet), since
    the only note that named it before is the dated measurement, which keeps the old name.
  - `whiteboard/TODO.md`: the *Tiny Tasks* bullet is struck.
* **Decisions taken**:
  - **No constant.** Nothing in code or tests derives the production address: `returnUrlFor` reads
    `SITE_URL` from the deployment, a local backend's is `http://localhost:<web port>`
    (`scripts/convex_auth_keys`), the app sets no `metadataBase`, Open Graph URL, canonical link
    or sitemap, the manifest's `start_url` is `/`, and the content pages link by path. So the
    plan's "one constant if there is none" has nothing to serve, and none was added.
  - **Kept as written** (Decision 2, dated or not live): `notes/20260928-cloud_measurements-a.md`,
    `notes/decisions/20260928-database-decisions.md`'s measurement, `human/`, `aside/`, and the
    finished oauth sprint's whiteboard (`whiteboard/20261010-oauth/`). Preview addresses
    (`triquet-git-<branch>-mrflips-projects.vercel.app` in `notes/deploy.md`,
    `.github/workflows/preview.yml`) and `tests/lib/build-stamp.test.ts`'s `VERCEL_URL` are
    Vercel's own deployment hosts, not production's name, and stay.
* **Discoveries**:
  - `notes/deploy.md`'s *Google sign-in* bullet sends a Coach to *path A* of
    `whiteboard/20261010-oauth/google-oauth-keys.md`, whose consent-screen table still gives
    `https://triquet.vercel.app/about`, `/privacy`, `/terms` and the authorized domain
    `triquet.vercel.app`. It is a finished sprint's record and keeps them; a Coach following it
    now should read `triquet.me` there. The live values are in *For the Coach*, below.
  - The contact address was already `info@triquet.me` (`SiteFooter`'s `ContactAddress`, the
    content pages, `e2e/policies.spec.ts`): nothing to change.
* **For the Coach** (outside the repo; this thread touched none of it):
  1. **Vercel**: add `triquet.me` (and `www.triquet.me`, redirecting to it, if wanted) to the
     project's domains and point the registrar's DNS at Vercel; then set `triquet.vercel.app` to
     redirect (308) to `https://triquet.me` in the same Domains page, so old links and bookmarks
     land.
  2. **Convex production**: `SITE_URL` to `https://triquet.me` (no trailing slash needed;
     `returnUrlFor` strips one), e.g. `./scripts/doppledo prd_janitor npx convex env set SITE_URL
     https://triquet.me`. Until it changes, a Google sign-in returns the browser to the old name
     (which the redirect then carries over, but the session is stored per origin, so switch it
     before or with the domain).
  3. **Google Cloud console**, production's OAuth client and consent screen: the redirect URI is
     on `<prod>.convex.site` and does **not** change. Change the consent screen's application
     home page, privacy policy and terms links to `https://triquet.me/about`, `/privacy`,
     `/terms`, and add `triquet.me` to its authorized domains (verified in Search Console if
     Google asks; a domain you own verifies by DNS TXT record, which is easier than the
     `vercel.app` route was). Drop `triquet.vercel.app` once nothing points at it. If the
     client lists authorized JavaScript origins, add `https://triquet.me` there.
  4. **Previews**: the project's default `SITE_URL` for preview deployments is untouched by this.
