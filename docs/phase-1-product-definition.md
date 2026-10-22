# UseMe Courier Service: Phase 1 Product Definition

Status: draft for your review. Nothing here has been built or tested yet.

## 1. Understanding

UseMe is a two-sided errands marketplace for Jalingo. Customers post an errand with a transparent price. Verified runners (walking, bicycle, keke, motorcycle, car) pick it up, complete it and get paid. The platform earns a fee, coordinates status and location, and resolves disputes.

The hard parts are not the screens. They are trust (who is the runner), money (shopping float, cash commission, refunds), safe assignment (no double accept) and privacy (who sees which address and location). The plan below is ordered around those.

## 2. Product challenges to the brief

These are places where I recommend a different default from the brief.

1. Launch with cash only. Online payments (Paystack) arrive in Phase 7. Cash still needs a ledger because the platform owes nothing to runners but runners owe commission. Recommended: runner commission balance with a block on accepting new jobs above a configurable debt limit.
2. Shopping money is the biggest fraud risk. A runner holding a customer's ₦5,000 can disappear. MVP rule: the customer pays the shopping budget to the runner directly in cash at handover, receipt photo is required, runner tier gates the maximum shopping budget (Verified low cap, Trusted higher). No platform-held float in the MVP.
3. Offers go to a feed, not a push race. A filtered "available errands" feed with an atomic accept function is simpler and cheaper than push dispatch. Push notifications are layered on top later.
4. Keke or vehicle transport for goods and passenger-style requests are out of the MVP. People transport raises licensing and insurance questions. Goods and parcel moves by keke stay in as an errand with a required transport type.
5. Phone OTP costs money and SMS delivery in Nigeria is unreliable. Launch with email and password for auth, collect phone numbers as a profile field, and treat phone verification as an admin-checked step for runners. Add SMS OTP when a provider is chosen.
6. Background tracking is not reliable in a PWA. MVP tracking works only while the runner app is open and in the foreground, with a visible banner saying so. True background tracking waits for Capacitor.
7. The public Nominatim and OSM tile servers are not for production traffic. I will wrap geocoding, routing and tiles behind service modules and start with a provider that has a free tier and clear terms (candidates: MapTiler, Geoapify, OpenRouteService). Choice and cost go in the risk register.
8. Walking runners need a distance cap per transport type, otherwise matching will offer a 6 km job to a walker. The cap is a configurable value on the transport category.

## 3. MVP boundary

In the MVP
- Branded responsive PWA, landing page, auth (email and password), password reset
- Roles: customer, runner, admin, with admin assigned only through a documented SQL step
- Runner application with human review (no automated ID checks), document upload to private storage
- Errand categories: pickup and delivery, shopping, market run, queue or collection, custom
- Map location picker with manual address fallback
- Server-side pricing engine with admin-editable rules and stored quote snapshots
- Available errands feed with eligibility filtering, atomic accept, status transitions validated in the database
- Foreground location sharing during an active job
- Delivery code or customer confirmation, receipt photo for shopping
- Ratings, basic disputes and support tickets, audit log
- Admin: runner queue, errand list, pricing config, disputes, real counts
- Cash payment records and commission ledger

Next
- Paystack payments, refunds, receipts
- In-app notification polish, web push
- Tier automation, business accounts

Later
- Capacitor, background tracking, scheduled errands, subscriptions, other towns, advanced analytics

## 4. Core journeys

Customer: sign up, pick a category, enter details, set pickup and destination on the map, review the price breakdown, confirm, wait for a runner, see runner profile and live status, confirm completion with a code, rate.

Runner: sign up, apply with transport and documents, wait for approval, go available, browse the feed, accept, move through statuses (heading to pickup, arrived, collected, en route, completed), attach evidence, see earnings.

Admin: review applications, approve or request more information, watch active errands, resolve disputes, edit pricing rules, read the audit log.

Status flow is table-driven per errand category so shopping, queue and delivery each get only the transitions that make sense.

## 5. Information architecture

Public: `/`, `/how-it-works`, `/safety`, `/faq`, `/login`, `/register`, `/forgot-password`, `/become-a-runner`

Customer: `/app` (home), `/app/errands/new` (stepper), `/app/errands/:id`, `/app/history`, `/app/addresses`, `/app/support`, `/app/account`

Runner: `/runner` (dashboard), `/runner/apply`, `/runner/jobs` (feed), `/runner/jobs/:id`, `/runner/earnings`, `/runner/profile`

Admin: `/admin`, `/admin/runners`, `/admin/errands`, `/admin/disputes`, `/admin/pricing`, `/admin/service-areas`, `/admin/audit`

Navigation is a bottom tab bar on mobile and a sidebar on desktop, per role.

## 6. Data and security plan

Principles
- Money stored as integer kobo with a currency column
- Roles in a separate `user_roles` table, writable only by a security-definer function called by admins, never from a profile row
- RLS on every exposed table, tested with a script that signs in as each role
- Anything privileged runs in Postgres functions (RPC) or Edge Functions: create quote, post errand, accept errand, advance status, approve runner, record payment
- PostGIS for distance and proximity; routes come from the routing provider and are stored only as summary distance and duration
- Private storage buckets for runner documents and evidence, signed URLs only, admin access logged

Tables (grouped)
- Identity: `profiles`, `user_roles`, `saved_addresses`, `service_areas`
- Runners: `runner_profiles`, `runner_verifications`, `runner_documents`, `transport_categories`, `runner_capabilities`
- Errands: `errand_categories`, `errands`, `errand_stops`, `errand_offers` (only if declines need recording), `errand_assignments`, `errand_status_history`, `errand_locations` (short retention)
- Pricing: `pricing_rules`, `pricing_quotes`
- Money: `payments`, `refunds`, `financial_ledger`, `runner_earnings` (a view over the ledger rather than a table)
- Trust: `ratings`, `disputes`, `support_tickets`, `prohibited_task_rules`, `runner_tier_rules`
- System: `notifications`, `audit_logs`

I will merge `errand_events` into `errand_status_history` and drop `runner_earnings` as a table. Earnings derive from the ledger so there is one source of truth.

Assignment safety: `accept_errand(errand_id)` locks the errand row, checks runner approval, transport capability, distance cap and status, inserts the assignment and flips status in one transaction. A partial unique index allows only one active assignment per errand.

Preview privacy: the feed is served by a view or RPC that returns area names, rounded coordinates, distance, earnings and category only. Exact addresses and customer phone appear after assignment.

## 7. Technical risks

| Risk | Handling |
|---|---|
| Map provider limits and cost | Service modules, provider chosen in Phase 6, manual address fallback always available |
| Double accept | Row lock plus unique index, tested with concurrent calls |
| RLS gaps leaking addresses or documents | Role-by-role permission test script, run before each phase closes |
| Cash commission debt | Ledger plus configurable debt limit blocking new accepts |
| Fake runners and ID fraud | Human review, document submission shown separately from verified status, tiered shopping caps |
| PWA background location limits | Foreground-only in MVP, stated honestly in the UI |
| Weak connectivity | No optimistic fake success, retry states, small bundles, route-level code splitting |
| Payment webhook duplicates (Phase 7) | Idempotency keys and unique provider references |
| Nigerian data protection (NDPA 2023) | Consent for location and emergency contact, retention limits, legal review before public launch |
| SMS cost and delivery | Deferred, email first |

## 8. Folder structure

Follows your suggested layout with these changes: `src/features/*` owns pages, hooks and queries per domain, `src/services/*` owns device and provider wrappers, `supabase/migrations` is the only way schema changes, `supabase/tests` holds the RLS permission tests, `docs/` holds this file, an implementation checklist and a risk and cost register.

## 9. Implementation sequence

1. Phase 2 and 3 combined in practice: scaffold the Vite app and build the design system and the customer and runner screens against typed demo data, clearly labelled
2. Phase 4: migrations for identity, runners, service areas, RLS, first-admin procedure, permission tests
3. Phase 5: pricing RPC, errand creation, feed, atomic accept, status transitions, completion and ratings
4. Phase 6 maps, 7 payments, 8 admin and trust, 9 PWA and Netlify, 10 release checklist

I recommend starting the database before polishing every screen, so screens are built against real types.

## 10. Assumptions

- Auth is email and password at launch, phone stored but not OTP-verified
- Admin staff are few, so a single `admin` role plus a `super_admin` for role changes is enough at first
- Currency is NGN only, one service area (Jalingo), schema supports more
- Platform fee is a percentage with a minimum, shown as an illustrative value until you set real prices
- Illustrative pricing is labelled as such everywhere
- Supabase free tier for development, paid tier before launch because of backups and storage
- Netlify free tier is enough for the frontend at launch
- Runner payout to bank accounts is manual in the MVP
- English UI first, copy kept in one place so Hausa can be added

## 11. Next concrete action

You create the Supabase project and the repo, then I give you the scaffold commands and the first migration. Needed from you, in this order:
1. A Supabase project (name `usemecourier`, region closest to Nigeria that is offered) and its project URL and anon key, put in a local `.env.local`
2. A GitHub repo for the code
3. The email address that will become the first admin
