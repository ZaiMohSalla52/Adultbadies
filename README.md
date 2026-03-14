# Adult Badies — Stage 0 Foundation

This repository contains a production-oriented Stage 0 setup for a Next.js + Supabase application.

## Stack

- Next.js (App Router) + TypeScript
- Supabase (Auth/Postgres/Storage/Realtime ready)
- Vercel deployment defaults

## Project Structure

```text
src/
  app/
    (public)/
    (auth)/
    (app)/
    (admin)/
  components/
    layout/
    ui/
  lib/
    supabase/
supabase/
  migrations/
```

## Environment Variables

Copy `.env.example` into `.env.local` and fill in values.

Required for app runtime:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Optional for privileged server jobs:

- `SUPABASE_SERVICE_ROLE_KEY`

## Scripts

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run typecheck`

## Stage Readiness

- Modular app route groups for public/auth/app/admin sections.
- Shared reusable UI primitives and design tokens.
- Supabase browser + server clients configured for Next.js.
- Initial RLS-ready migration scaffold for Stage 1 database work.
