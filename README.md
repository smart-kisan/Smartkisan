# Smart Kisan (स्मार्ट किसान)

Smart Kisan Bharat - Modern Agri Ecosystem (By Smart Star Solutions)

The main application is a Next.js App Router shell that hosts the shared Smart
Kisan portal UI. The existing Express API and Replit-managed service workflows
remain in place; marketplace, bids, profiles, orders, government records, and
KhetKhata entries are read and written through that API and Supabase. The
application does not seed or render demo records.

## Run locally

```sh
pnpm install
pnpm run dev
```

For Replit, start the existing `Smart Kisan (स्मार्ट किसान)` web service and
`API Server` workflows. The Replit proxy routes `/api` to the API artifact.

## Environment

Copy `.env.example` only for local development, then replace the example values
with real values. In Replit, configure variables through Secrets instead.
Never commit `.env`, `.env.local`, or a real `SUPABASE_SERVICE_ROLE_KEY`.

Required runtime configuration:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public
  Supabase URL/key used for safe realtime invalidation signals.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only API credential; never bundle it
  into Next.js client code.
- `GEMINI_API_KEY` — server-only Gemini key for assistant and crop diagnosis.
- Clerk keys — supplied by the Replit-managed Clerk integration; set the
  corresponding public and server values in any external deployment.
- `API_SERVER_ORIGIN` — required on Vercel. Set it to the HTTPS origin of the
  separately published Smart Kisan API service. Replit routes `/api`
  automatically.

The Supabase migration is `supabase/migrations/001_smart_kisan.sql`. Apply it
to the intended Supabase project before expecting live data. The migration
contains no sample rows. Until Supabase is configured and migrated, API-backed
screens report an explicit unavailable state instead of showing fabricated
listings or ledger entries.

## Build and checks

```sh
pnpm run typecheck
pnpm run build
```

`vercel.json` configures the root Next.js build. Vercel must also have the
environment variables above, including `API_SERVER_ORIGIN`; the Vercel
connector is not required for building or deploying from the Vercel dashboard.
The existing API-server and Smart Kisan Replit services are retained.
