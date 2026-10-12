# Google sign-in keys: one for production, one for dev

For the Coach. Checked 2026-10-10 against Google's own help pages, Convex Auth's Google guide, and
the `@convex-dev/auth` 0.0.96 we have installed. Sources are at the end. Where Google's pages
disagree with each other, it is said so.

## What we want, and why it is mostly easy

We ask Google for `openid email profile` and nothing else. Google calls these **non-sensitive
scopes**, which changes everything:

* **No verification is needed to go to production.** Scope verification is for sensitive and
  restricted scopes only.
* **No user cap.** The "100 new users" cap applies after the *unverified app* screen, which is
  shown for sensitive scopes, not ours.
* **No 7-day expiry, even in Testing.** A test user's grant expires after seven days, except
  when the only scopes are `openid`, `userinfo.email` and `userinfo.profile`.

So the key for a few hundred people is the same kind of key as the beta one. The difference is
the switch on the *Audience* page: **Testing** (only listed test users, at most 100) or **In
production** (any Google account). You flip it with **Publish app**, and it takes effect at
once.

The one thing you give up without more work is **branding**. An unverified brand shows no app
name and no logo. The consent screen names the domain the redirect goes to, which with Convex
Auth is the Convex deployment's HTTP-actions host: users will read
**"to continue to `<prod>.convex.site`"**. Getting "Triquet" (and a logo) on that screen is
*brand verification*, and that is where the custom domain comes in (path C, below).

| Path | Users see | Effort | Cost |
| --- | --- | --- | --- |
| A. Publish now, unbranded (recommended) | `<prod>.convex.site`, no name or logo | 15 to 30 minutes | free |
| B. Brand verification on what we have | Triquet, if Google accepts it (likely not) | a few hours, then 0 to 3 business days of review | free |
| C. Custom domain, then brand verification | Triquet, and a logo | about half a day, then review | about $11 a year, plus $25 a month for Convex Pro, or a free but untested Vercel rewrite |

## Path A: publish now, unbranded (recommended; 15 to 30 minutes)

Use a separate Google Cloud project for production, apart from the dev one (Google's own
advice). In the Google Cloud console, *Google Auth Platform*:

1. **Branding.**
   - App name: Triquet.
   - User support email, and developer contact email.
   - No logo: uploading one is what sends the brand to verification.
   - Homepage, privacy-policy and terms links: see *The branding page, field by field*, below.
   - **Authorized domains:** add `<prod>.convex.site` (where the callback lands) and the
     app's Vercel host (`<app>.vercel.app`). Both `convex.site` and `vercel.app` are on the
     Public Suffix List, so each subdomain counts as a domain of its own and is accepted.
     Search Console ownership is **not** needed for this path. It is needed only for brand
     verification.
2. **Data access.** Add the scopes `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`,
   and nothing else.
3. **Clients → Create client → Web application.**
   - **Authorized redirect URI:** `https://<prod>.convex.site/api/auth/callback/google`. That is
     the production deployment's HTTP-actions URL (Convex dashboard → Settings → URL & Deploy
     Key, "HTTP Actions URL"), plus `/api/auth/callback/google`.
   - **Authorized JavaScript origins:** none needed. The redirect is Convex's, not the
     browser's.
   - Copy the **client ID** and **client secret**. The secret is shown in full only now; keep it
     out of chat and files.
4. **Audience → Publish app**, confirm. The status reads *In production*.
5. **Hand the keys to Convex**, on the production deployment (dashboard → Settings → Environment
   Variables, or `npx convex env set` with production's key): `AUTH_GOOGLE_ID` and
   `AUTH_GOOGLE_SECRET`.
   - `SITE_URL` must already be the app's exact public address. It is where Convex Auth sends a
     browser back, and a `redirectTo` that does not start with it is refused.
   - If you keep a copy of the secret in Doppler as the record, keep it in a production config,
     never a dev one. Doppler has no sync to Convex, so the deployment's copy is set by hand
     (`doppler run -- npx convex env set ...` works, if you prefer that to pasting).
6. Leave preview deployments without these. Google allows no wildcard redirect URIs, and every
   Convex preview has its own `.site` host. Thread 1 hides the Google button on a deployment
   that has no `AUTH_GOOGLE_ID`, so previews stay anonymous-only.

### Pages

Google's branding help says the homepage and privacy-policy links are "required for all external
production apps", then calls them "recommended" in the paragraph above. In practice they are
enforced when you submit for brand verification. Whether the console blocks *Publish* without
them could not be confirmed. The sprint's thread 7 (`google_pages`) built all three pages, so the
question no longer matters: `/about` describes the app and links the other two, and all three are
public and prerendered, with no sign-in in front of them.

### The branding page, field by field

Production is served at `triquet.vercel.app` (`notes/20260928-cloud_measurements-a.md`). If it
moves to a domain of its own (path C), put that host in place of it everywhere below.

| Field on *Google Auth Platform → Branding* | Enter |
| --- | --- |
| App name | `Triquet` |
| User support email | `info@triquet.me`, if the console offers it (see below); else your own |
| App logo | none (a logo sends the brand to verification) |
| Application home page | `https://triquet.vercel.app/about` |
| Application privacy policy link | `https://triquet.vercel.app/privacy` |
| Application terms of service link | `https://triquet.vercel.app/terms` |
| Authorized domains | `triquet.vercel.app`, and `<prod>.convex.site` (the production deployment's HTTP Actions host) |
| Developer contact information | your own address |

* **The support email** is chosen from a list: the signed-in Google account's own address, or a
  Google Group it manages. `info@triquet.me` appears there only if it is that account, or a group
  of it; the pages give it as the contact either way.
* **The dev project** (Testing) needs none of the links. If you fill them in anyway, give it the
  same production URLs: a local lane's address is no page Google can reach.

## The dev key (you may have this already)

A second project, left in **Testing**, with you (and anyone helping test) listed as test users.
Its scopes are the same three, so its grants do not expire weekly.

* **Redirect URIs.** A local backend's HTTP actions are on `127.0.0.1`, which Google allows over
  plain `http` (loopback is exempt from the no-raw-IP rule).
  - `http://127.0.0.1:3500/api/auth/callback/google`: your `dev` role, lane 0.
  - `http://127.0.0.1:3501/api/auth/callback/google`: the `agent` role, lane 0, should you want
    to try an agent's build by hand.
  - Other lanes are +10 per lane (`scripts/lanes.ts`). Add them only if you need them.
* **The keys** go in Doppler's `dev` config as `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`. Thread 1
  makes `scripts/convex_dev` set them on a local backend when its Doppler config has them, beside
  the throwaway JWT keys it already gives one.
* Nothing automated ever signs in to Google: agents and e2e test up to the redirect, and the
  hand-off in unit tests.

## Path B: brand verification on what we have (not recommended)

Brand verification needs **every** authorized domain verified in Google Search Console.

* **`<app>.vercel.app`** can be verified with an HTML meta tag. One project reports Google
  accepting it as an authorized domain, but a September 2026 forum thread reports brand
  verification itself failing on a verified `*.vercel.app` ("home page URL is not registered to
  you"). Google's reply there: get a real domain.
* **`<prod>.convex.site`** would need verifying too. No one reports having done it.

Expect a rejection, so skip this path.

## Path C: a custom domain, for the name on the consent screen

If you want "Triquet" on the consent screen:

1. **Buy a domain on Vercel and attach it.** The Hobby plan allows custom domains (50 per
   project), and Vercel sells them at about cost: a `.com` is about $11.25 a year. A `.xyz` or
   `.site` is $1.99 the first year but $13 or $27 to renew. Vercel sets up DNS itself. About an
   hour, plus propagation.
2. **Verify it in Search Console** with a DNS TXT record.
3. **Move the callback off `convex.site`.** There are two ways:
   - **Convex Pro**: a custom domain for the deployment (for example `api.<domain>`), with
     `CUSTOM_AUTH_SITE_URL` set to it, which is exactly what that variable is documented for. Pro
     is $25 per developer per month.
   - **A Vercel rewrite** of `/api/auth/*` to `<prod>.convex.site`, with `CUSTOM_AUTH_SITE_URL`
     set to the app's own origin. Free, but undocumented and untested, and it puts Vercel in the
     sign-in path as a proxy: config, not a server function, but **a step toward the server that
     the client-first rule asks a Coach about.** We would not take it without your word.
4. **Submit for brand verification:** a public homepage that describes the app and links the
   privacy policy, on the same domain. Review is minutes if automated, two or three business days
   if not.

About half a day, plus review.

None of this needs redoing path A's work. Add the new domain, add the new redirect URI beside the
old one, submit the brand, and remove the `convex.site` URI once the new one works.

## Integrations that might save time

* **Vercel.** The domain purchase above is the real shortcut: buy, attach and DNS in one place.
  Vercel has no Google OAuth integration of its own.
* **Convex.** No Convex-owned Google client exists. Convex can auto-provision **WorkOS AuthKit**
  per deployment, previews included, and WorkOS lends default Google credentials in staging.
  Production still needs your own Google client, and adopting it would replace Convex Auth with
  a hosted hub, reversing the October choice (`notes/stack.md`, *Authentication*). Not worth it
  for this.
* **Doppler.** It stores the ID and secret, and syncs them to Vercel (which does not need them).
  It has no native Convex sync, and no Google OAuth feature.
* **Clerk, Auth0, WorkOS** all lend shared Google credentials for development only, and all need
  your own client in production. Clerk's production instance also needs a domain you own (not
  `vercel.app`). None of them saves the ten minutes.

## Sources

* Testing, the 100 test users, and the 7-day expiry: https://support.google.com/cloud/answer/15549945
* The 7-day exemption for `openid`/email/profile: https://developers.google.com/identity/protocols/oauth2 (Refresh token expiration)
* Scope verification for sensitive and restricted scopes only: https://support.google.com/cloud/answer/13463073
* Branding without verification shows the domain; required or recommended links: https://support.google.com/cloud/answer/15549049
* Brand verification (updated 2026-08-19): https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification
  - Its boilerplate mentions "an unverified app screen and user caps", as does
    https://support.google.com/cloud/answer/13464323.
  - The scope-specific pages contradict that for our scopes. Our reading: no warning, no cap.
* The 100-user cap after the unverified screen: https://support.google.com/cloud/answer/7454865
* Search Console ownership for brand verification: https://support.google.com/cloud/answer/13464321
* Redirect URI rules (no wildcards, loopback exempt): https://developers.google.com/identity/protocols/oauth2/web-server
* Convex Auth's Google setup (the `.convex.site` text on the consent screen): https://labs.convex.dev/auth/config/oauth/google
* `CUSTOM_AUTH_SITE_URL`: https://labs.convex.dev/auth/advanced
* Convex custom domains need Pro: https://docs.convex.dev/production/custom-domains
* Reports on `vercel.app`:
  - Brand verification failing: https://discuss.google.dev/t/oauth-branding-verification-stuck-home-page-url-not-registered-despite-search-console-verification-vercel-app/396107
  - Accepted as an authorized domain: https://github.com/DalyChouikh/TapNShow/issues/48
* Vercel Hobby limits: https://vercel.com/docs/limits
* Doppler and Convex: https://discord-questions.convex.dev/m/1208538911673155704
