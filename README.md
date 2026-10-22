# UseMe Courier Service

Errands and delivery platform for Jalingo, Taraba State. Your Errand. Our Runner.

Stack: React, TypeScript (strict), Vite, Tailwind CSS 4, React Router, TanStack Query, React Hook Form, Zod, Supabase.

## Run it

From the project root:

```
npm install
npm run dev
```

Open the address Vite prints. Without Supabase values the app runs in **preview mode**: signed-in screens open without login and show sample data, with a banner saying so. Preview mode only exists in `npm run dev`, never in a production build.

## Connect Supabase

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local`.
3. Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Project Settings > API.
4. Restart `npm run dev`.

Never put the service role key in this app.

## Checks

```
npm run lint
npx vitest run
npm run build
```

## Where things live

- `src/components/ui` reusable design system parts
- `src/components/layout` app shells and navigation
- `src/features/*` one folder per domain (auth, errands, pricing, runner, admin)
- `src/lib` formatting, validation, Supabase client, demo data
- `supabase/migrations` database changes (Phase 4)
- `docs` product definition and checklists

## Status

See `docs/implementation-checklist.md`. Screens that use `src/lib/demo/demoData.ts` are sample data and say so on screen.
