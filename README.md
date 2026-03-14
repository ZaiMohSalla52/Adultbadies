# Adult Badies — Stage 2 Authentication Foundation

This repository includes a production-oriented Stage 2 authentication layer for Adult Badies using Supabase Auth with App Router server/client boundaries.

## Stack

- Next.js (App Router) + TypeScript
- Supabase (Auth/Postgres/Storage/Realtime)
- Vercel deployment defaults

## Project Structure

```text
src/
  app/
    (public)/
    (auth)/
    (app)/
    (admin)/
    auth/callback/
  components/
    auth/
    layout/
    ui/
  lib/
    auth/
    supabase/
supabase/
  migrations/
```

## Environment Variables

Copy `.env.example` into `.env.local` and fill in values.

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Optional for privileged server jobs:

- `SUPABASE_SERVICE_ROLE_KEY`

## Scripts

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run typecheck`

## Stage 2 Auth Summary

### Implemented

- Email/password sign-up and sign-in via Supabase Auth.
- Sign-out flow from protected application shell.
- Session-aware route protection for app/admin route groups.
- Redirect of authenticated users away from auth pages.
- Auth callback route for confirmation/session exchange flows.
- Minimal profile bootstrap for new users through:
  - DB trigger on `auth.users` insert (`002_stage2_auth_profile_bootstrap.sql`).
  - Defensive app-level `profiles` upsert after successful sign-up.

### Route behavior

- Public routes stay accessible without session.
- `/(app)` and `/(admin)` require authenticated users.
- `/(auth)` pages redirect authenticated users to `/dashboard`.

### Database

- Stage 1 schema remains in `001_stage1_database_foundation.sql`.
- Stage 2 adds auth profile bootstrap migration.

The codebase is now ready for Stage 3 profile onboarding work.
