# Implementation checklist

## Done
- [x] Phase 1 product definition (`phase-1-product-definition.md`)
- [x] Project scaffold, strict TypeScript, Tailwind tokens, lint, tests, Netlify SPA redirect
- [x] Money helpers (integer kobo) with tests
- [x] Auth screens and forms with validation (need Supabase to function)
- [x] Pricing function with tests (sample rates, matches worked example of 1,187 naira)
- [x] Errand stepper with per-step validation and transport distance caps
- [x] Landing page, customer home, runner dashboard and feed (sample data, labelled)
- [x] Mobile check at 360 px: no horizontal overflow on any route

- [x] Phase 4 database: profiles, roles, audit log, config tables, runner application and review, private document bucket, errand records, row-level security
- [x] Phase 4 permission tests: 99 checks passing on a local PostgreSQL (`supabase/tests/permissions.sql`)
- [x] Found and fixed: an admin could approve their own runner application

- [x] Phase 4 frontend: roles loaded after sign-in, role guards on /runner and /admin, role-aware navigation
- [x] Runner application screen (details, document upload to the private bucket, submit, status and admin note)
- [x] Admin runner review screen (documents via short-lived links, approve, ask for more, reject, suspend, reinstate, per-vehicle check)
- [x] Runner availability switch calls the database function
- [x] 29 browser checks against a mocked Supabase backend, all passing (not run against the real project)

## Not done yet
- [ ] Phase 4 applied to the real Supabase project, first admin created (`supabase/scripts/make_first_admin.sql`)
- [ ] Phase 5 real errand creation, server pricing, atomic accept, status flow
- [ ] Phase 6 maps and location, Phase 7 payments, Phase 8 admin, Phase 9 PWA manifest and service worker
- [ ] Real Android device testing
- [ ] Check bundle size: the main file grew to about 180 kB compressed. Review in Phase 9
- [ ] Admin opening a document is not written to the audit log yet (Phase 8)
- [ ] Customer account screen, errand history, real errand posting (Phase 5)
