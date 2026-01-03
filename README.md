# LA County Programmatic SEO + Admin

Next.js 15 + Firebase app delivering 500 LA County SEO pages, estimate funnel, and Tesla-like admin studio. Data lives in Firestore; admin auth via Firebase Auth + session cookies.

## Setup
1) Copy `.env.example` to `.env.local` and fill:
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_SITE_URL=https://your-site.com
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
SESSION_COOKIE_SECRET=any-strong-string
```
2) Create Firebase project with Firestore + Email/Password auth. Add admin users to `admins/{uid}` with `role: "owner" | "editor"` and `email`.
3) Install deps: `npm install`

## Run locally
```
npm run dev
```
Visit `/admin/login`, sign in with Firebase Auth user that exists in `/admins`. Protected routes use session cookie verified server-side (non-admins see "Not authorized").

## Firestore rules & indexes
- Deploy rules: `firebase deploy --only firestore:rules`
- Deploy indexes: `firebase deploy --only firestore:indexes`
Files:
- `firestore.rules`
- `firestore.indexes.json` (slugPath, status, city.slug+status, service.slug+status)

## Admin studio
- /admin/login - Firebase Auth login
- /admin - dashboard + "Seed LA 500 Pages" (upserts 10 services, 50 locations, generates 500 pages, runs QA, sets status review on pass)
- /admin/locations - table + create/edit/delete
- /admin/services - table + create/edit/delete
- /admin/pages - filters, bulk generate/QA/publish/archive
- /admin/pages/new - create single page
- /admin/pages/bulk - create from multi-select location x service
- /admin/pages/[pageId] - editor (Content, SEO, Schema, QA, History), regenerate section, run QA, publish/unpublish
- /admin/jobs - job log
- /admin/settings - metadata

## Public routes
- `/` landing
- `/estimate` multi-step lead form -> `/api/leads`
- `/la-county/[city]/[service]` SEO renderer (404 unless published)
- `/sitemap.xml` from published pages
- `/robots.txt` references sitemap

## QA & generation
- `src/lib/generator.ts` deterministic template (targets 900-1200 words, required sections, FAQs, CTAs, schema JSON-LD, cost disclaimer) with stable variants by hash(citySlug+serviceSlug).
- `src/lib/qa.ts` checks word count, required sections, meta length warning, duplication score via shingles against same-service pages; status set to review on pass.

## Tech notes
- All data from Firestore; no runtime FS reads.
- Server actions/API routes verify admin via Firebase session cookie (`/api/admin/session`).
- Base URL for canonical/sitemap uses `NEXT_PUBLIC_SITE_URL` (defaults to http://localhost:3000).
- Deploy to Vercel normally (`vercel --prod`), ensure env vars set and Firebase Admin creds present.

## Setup in 15 minutes (do this exactly)
1) Create Firebase project, enable Firestore + Email/Password Auth.
2) Deploy security: `firebase deploy --only firestore:rules` and `firebase deploy --only firestore:indexes`.
3) Copy `.env.example` to `.env.local` and fill all Firebase client + admin vars (ensure `FIREBASE_ADMIN_PRIVATE_KEY` keeps `\n` or actual newlines).
4) Install deps: `npm install`.
5) Run `npm run dev` and open `/admin/login`; sign up or sign in a user, then create `/admins/{uid}` doc with `role: "owner"` and `email`.
6) Seed pages from `/admin` -> "Seed LA 500 Pages" (redirects to job detail). If it pauses on Vercel, open `/admin/jobs/{jobId}` and click "Continue chunk" until progress reaches 500/500.
7) Publish a page from `/admin/pages` (Generate -> Run QA -> Publish) and verify `/la-county/pasadena/kitchen-remodeling`.
8) Edit site settings at `/admin/settings` (siteUrl, indexing toggle, sitemapLimit) and confirm `/sitemap.xml` and `/robots.txt` reflect changes.

> After changing `.env.local`, stop and restart `npm run dev` so env vars reload.

## Deploying to Vercel
1) Add all `.env.local` values as Vercel env vars (keep `\n` in `FIREBASE_ADMIN_PRIVATE_KEY`).
2) Deploy via Vercel; visit `/admin/login`.
3) Run seed job from `/admin`; use `/admin/jobs/{jobId}` "Continue chunk" if the seed exceeds serverless time.
4) Publish at least one page and verify the live public route and `/sitemap.xml`.

