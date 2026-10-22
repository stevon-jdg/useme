# Database

Migrations in `migrations/` run in filename order.

| File | What it adds |
|---|---|
| `20261020000001_identity_and_config.sql` | Profiles, roles, audit log, service areas, transport and errand categories |
| `20261020000002_runner_onboarding.sql` | Runner application, documents, review, suspension |
| `20261020000003_runner_documents_storage.sql` | Private bucket for runner documents |
| `20261021000001_errands.sql` | Errand records, read-only for customers |
| `20261021000002_block_self_review.sql` | An admin cannot approve their own runner application |

## Apply to Supabase

Paste each file into Supabase > SQL Editor, in order, and run it. Run each file once.
Then create the first admin with `scripts/make_first_admin.sql`.

## Permission tests

`tests/permissions.sql` checks 99 rules: who can read what, who can change what, and that
nobody can promote themselves. It rolls back, so it keeps no data.

On Supabase: paste it into the SQL Editor and run it. The messages tab should end with `ALL PASSED`.

On your own computer with a local PostgreSQL, from the project root:

```
createdb useme_test
psql -d useme_test -f supabase/tests/support/local_supabase_stub.sql
for f in supabase/migrations/*.sql; do psql -d useme_test -v ON_ERROR_STOP=1 -f $f; done
psql -d useme_test -v ON_ERROR_STOP=1 -f supabase/tests/permissions.sql
```

The stub file recreates the small part of Supabase these scripts need. Never run it on Supabase.

## Known limits

- Admin reads of runner documents are not logged yet. Phase 8 adds signed links that log each access.
- Pricing, quotes, the runner feed, accepting jobs and status changes arrive in Phase 5.
