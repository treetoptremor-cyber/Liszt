# Liszt

Shared grocery lists, to-dos and notes for families and couples. A clean,
installable PWA: one person starts a space, shares a short code (like
`PLUM-FOX-42`), and everyone's lists stay in sync — no accounts, no app store.

## Features

- **Groceries** — check-off lists with quantities, smart "aisle" grouping
  (produce, dairy, pantry…) with automatic categorization of common items,
  and quick re-add suggestions based on what your family actually buys.
- **To-dos** — shared task lists with per-person assignment.
- **Notes** — free-form shared notes for gift ideas, recipes, plans.
- **Spaces** — join with a share code and a display name. Multiple lists per
  tab, multiple spaces per device.
- **Sync** — near-live updates (a couple of seconds) between everyone's
  phones, with optimistic UI and an offline queue: changes made in a dead
  zone in the store are saved and pushed when you're back online.
- **PWA** — installable on iOS/Android/desktop, works offline, Helvetica-only
  typography on a warm off-white palette. Light mode always.

## Local development

```bash
npm install
npm run dev
```

That's it — with no `DATABASE_URL` set, Liszt runs on an embedded Postgres
([PGlite](https://pglite.dev)) persisted to `./.pglite`. No database setup
needed for development.

## Deploying to Vercel (free, no domain needed)

1. Push this repo to GitHub.
2. In [Vercel](https://vercel.com/new), **Import** the repo. Framework is
   auto-detected (Next.js) — accept the defaults and deploy.
3. Add the database: in your Vercel project go to the **Storage** tab →
   **Create Database** → choose **Neon** (Postgres, free tier) → accept.
   This automatically sets `DATABASE_URL` for the project.
4. **Redeploy** (Deployments → ⋯ → Redeploy) so the app picks up the new
   environment variable.

Your app is live at `https://<project>.vercel.app`. The database schema
creates itself on first use — nothing to migrate.

> Note: the service worker (offline support) only registers on production
> builds. Locally you can test it with `npm run build && npm start`.

## How it works

- **Next.js App Router** (React 19) — UI plus API route handlers in one
  deployable, nothing else to host.
- **Postgres** — Neon serverless driver in production, PGlite locally, both
  behind one tiny query adapter ([lib/db.ts](lib/db.ts)). Schema is created
  idempotently on first query.
- **Sync model** — every change is an *op* (`item.add`, `note.update`, …).
  The client applies ops optimistically over the last known server state and
  queues them (persisted to `localStorage`) through a single
  `POST /api/spaces/:code/mutate` endpoint; adds are idempotent so retries
  are safe. A version counter on the space makes polling cheap: the client
  asks "anything new since v42?" every few seconds and gets a tiny response
  unless something changed.
- **Identity** — no accounts. A space's share code admits you; joining
  creates a member row and the device remembers your member id. All reads
  and writes are scoped server-side to the space and verified against
  membership.

## Privacy note

Anyone with a space's share code can join that space, like a shared photo
album link. Codes are random (two words + digits); don't post them publicly.
