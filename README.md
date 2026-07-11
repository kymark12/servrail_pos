# ServRail POS

Touch-first, multi-tenant point-of-sale for ServRail businesses. A tenant owner sets
up their menu, staff, and printer in an admin area; cashiers ring up cash orders on a
device-local PIN. POS sales flow into the same sales dataset the Daily Sales Summary
app reads, so a business sees one number across products.

> **Prototype status.** Phases 0–2 are built (schema, tenant admin, and an online-first
> cashier till). Offline capture, installable PWA, and the WebUSB thermal printer are
> deferred — see [Status](#status). Full product vision: [`docs/POS_Prototype_Roadmap.md`](docs/POS_Prototype_Roadmap.md).

## Platform context

ServRail is a small multi-tenant SaaS platform where several product apps share **one
Neon Postgres database**:

- **`daily-sales-summary-app`** — owns the identity/tenant core (`User`, `Business`,
  `Membership`) and the sales tables (`SalesUpload`, `SalesRecord`), and owns the
  shared DB's Prisma **migration history**.
- **`servrail-backoffice`** — operator-only console that owns the `Product` catalog and
  per-tenant `Entitlement` rows (which products each business may use).
- **`pos-prototype`** (this app) — owns the POS domain tables and reads/writes the
  shared tables above.

**Ownership rule (important):** each app owns its own tables. This app applies **only its
own tables** via an idempotent DDL script and must **never run `prisma migrate` against
the shared database** — see [Database](#database).

## How it fits together

- **Access is gated by entitlement.** The admin and till require an `ACTIVE` `Entitlement`
  for product `key = "pos"`, granted in the back-office. Without it, users are sent to a
  "POS not enabled" page. (`src/lib/entitlement.ts`)
- **Two auth surfaces.** Tenant owners sign in with an email/password Auth.js session
  (the same identity DSS uses) to reach the admin and open the till. Cashiers then clock
  in with a **device-local PIN** (`src/lib/pos-session.ts`) that tags orders with the
  staff member.
- **POS → sales dataset.** A cash checkout writes an `Order` + `OrderItem`s and, in the
  same transaction, one `SalesUpload(source = POS)` + a `SalesRecord` per line — the same
  rows DSS reports on. (`src/app/pos/actions.ts`)

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Prisma 6 + PostgreSQL (Neon) ·
Auth.js v5 (Credentials) · Tailwind CSS v4 + shadcn · bcrypt · Zod.

## Getting started

**Prerequisites:** Node 20.17+ or 22.9+, and access to the shared Neon database.

1. **Install**
   ```bash
   npm install
   ```
2. **Configure** — copy `.env.example` to `.env` and point it at the shared Neon DB
   (pooled `DATABASE_URL`, direct `DIRECT_URL`), plus `AUTH_SECRET` (`npx auth secret`)
   and `AUTH_TRUST_HOST=true`.
   > Prefer a **Neon branch** for development so you never touch production data.
3. **Apply the POS tables** (idempotent DDL — safe to re-run):
   ```bash
   npm run db:apply
   ```
   To grant POS to a business, add/keep the `pos` entry in the back-office catalog and
   run its `npm run db:apply`, then enable the entitlement for that business in the
   back-office console.
4. **Run**
   ```bash
   npm run dev
   ```
   Sign in as an owner → **Open till →** → enter a cashier PIN.

Sample café menu (5 categories, 20 items): `npx tsx prisma/seed-demo.ts`.

## Run in Docker + demo over Tailscale

To run in a container and reach it from a phone/tablet over your tailnet:
```bash
docker compose up --build      # http://localhost:3000
```
Full runbook (Tailscale HTTPS, opening it on a Fold phone / iPad, iOS WebUSB caveat):
[`docs/RUN_LOCAL_DEMO.md`](docs/RUN_LOCAL_DEMO.md).

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm run start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate the Prisma client |
| `npm run db:apply` | Apply POS-owned tables via idempotent DDL (**not** `prisma migrate`) |
| `npm run db:studio` | Open Prisma Studio |

## Database

The schema (`prisma/schema.prisma`) declares three groups:

1. **Shared identity/tenant core** — `User`, `Business`, `Membership`, `Product`,
   `Entitlement` — re-declared read-only (owned by DSS / the back-office).
2. **DSS-owned sales tables** — `SalesUpload`, `SalesRecord` — re-declared read-write so
   POS sales land in the shared dataset; `UploadSource` gains a `POS` value.
3. **POS-owned tables** — `Staff`, `MenuCategory`, `MenuItem`, `Order`, `OrderItem`,
   `PrinterConfig`.

Because DSS owns the shared migration history, POS creates only its own tables (and the
`POS` enum value) via `prisma/apply-schema.ts` — idempotent, re-runnable, over the direct
connection. **Do not `prisma migrate` against the shared DB.**

## Project structure

```
prisma/
  schema.prisma        # shared (re-declared) + POS-owned models
  apply-schema.ts      # idempotent DDL for POS-owned tables (no prisma migrate)
  seed-demo.ts         # sample café menu
src/
  app/
    (auth)/sign-in     # owner email/password sign-in
    (admin)/           # tenant admin — overview, menu, staff, printer (entitlement-gated)
    pos/               # cashier till — PIN clock-in, menu grid, cart, cash checkout
    not-enabled/       # shown when a business lacks the POS entitlement
    api/auth/          # Auth.js route handlers
  components/{admin,pos,ui}
  lib/
    auth.ts, auth.config.ts, tenant.ts   # owner session + tenant resolution
    entitlement.ts                       # POS entitlement gate
    pos-session.ts                       # device-local cashier PIN session
    db.ts, format.ts, utils.ts
docs/                  # roadmap, local-demo runbook
```

## Status

| Phase | Scope | State |
|---|---|---|
| 0 | App scaffold + shared-DB-safe schema | ✅ Done |
| 1 | Tenant admin: entitlement gating, Staff / Menu / Printer | ✅ Done |
| 2 | Cashier till: PIN, menu grid, cart, cash checkout, receipt (online-first) | ✅ Done |
| — | Offline capture (Dexie), installable PWA (service worker) | ⏳ Deferred |
| — | WebUSB thermal printer (ESC/POS) — Android/Chrome only | ⏳ Deferred |

## Notes

- Cash-only, single till per business in the prototype (see the roadmap for what's
  intentionally out of scope).
- `.env` and `DEMO_CREDENTIALS.md` are gitignored — never commit credentials.
