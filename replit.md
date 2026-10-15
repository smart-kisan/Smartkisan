# Smart Kisan (स्मार्ट किसान)

Hindi-first agricultural marketplace and farm-management PWA for farmers,
buyers, and mandi/government operators.

## Run & Operate

- `pnpm run dev` — run the root Next.js application
- `pnpm --filter @workspace/api-server run dev` — run the Express API service
- `pnpm run typecheck` — typecheck libraries, the Next.js app, and workspace packages
- `pnpm run build` — build the root Next.js app
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Supabase schema: apply `supabase/migrations/001_smart_kisan.sql` to the intended Supabase project
- Required secrets: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`; Clerk is managed by Replit
- Never commit `.env` or `.env.local`; use Replit Secrets for credentials

## Stack

- Root application: Next.js App Router, React, Tailwind CSS
- Existing Smart Kisan UI remains the shared portal source used by the root app and retained Replit workflow
- API: Express 5, Clerk-authenticated, OpenAPI-generated client
- Data: Supabase PostgreSQL with RLS and server-only service-role access
- AI: Gemini calls are server-side and require `GEMINI_API_KEY`
- PWA: manifest, root-scoped service worker, offline app shell, install prompt

## Where things live

- `app/` — root Next.js entry, layout, and catch-all route
- `artifacts/smart-kisan/src/` — shared Smart Kisan portal UI and theme
- `artifacts/api-server/src/` — authenticated API and server-side integrations
- `lib/api-spec/openapi.yaml` — API contract source of truth
- `supabase/migrations/` — Supabase schema, policies, RPCs, and triggers
- `artifacts/smart-kisan/public/` and root `public/` — PWA assets

## Architecture decisions

- The Supabase service-role key is server-only; the browser uses only public keys and the authenticated API.
- The API and UI remain separately runnable Replit services; the root Next.js app consumes the existing UI and `/api` routing.
- No demo data is seeded. Empty database states are shown as empty states.

## Product

- Farmer listings, buyer bids and locked deals, government MSP/mandi oversight, privacy masking, KhetKhata, and Gemini crop assistance.

## User preferences

- Product identity: “Smart Kisan” (स्मार्ट किसान), using the supplied Bharat emblem and Smart Kisan Bharat tagline.
- All business records must come from Supabase; never add fabricated listings, bids, prices, profiles, or ledger rows.

## Gotchas

- Apply the Supabase migration before using live data; no Supabase credentials are present in source files.
- For Vercel, configure `API_SERVER_ORIGIN` to the published HTTPS API service before building.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
