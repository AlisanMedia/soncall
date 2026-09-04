# Soncall dashboard and recording repair

Baseline: c069b1c31390a6ea5d6ac0d4cc64a2ff52d7cb9c.

## Confirmed and repaired

- Duplicate audioResponse declaration prevented compilation. Recharts tooltip also failed type checking.
- Manager analytics/activity constructed oversized UUID URL filters and truncated collections at PostgREST's row limit. Database joins and paginated aggregation replace those requests.
- Analytics unnecessarily imported an eagerly initialized service-role client. AI and gamification clients now initialize inside their operations; missing AI configuration returns a clear service error.
- Recording analysis verifies lead assignment and recording origin/path, uses authenticated Storage download, surfaces provider/persistence failures and handles Istanbul callback dates consistently.
- Lead detail access no longer trusts somebody else's activity history. Manual leads receive a validated market/SDR, and large assignments use paged reads and guarded writes with explicit partial-conflict reporting.
- Client activity writes respect RLS and verify assignment. Cron SMS/report endpoints reject missing or incorrect cron authorization; digest success timestamps map to the correct report.
- Restored a complete dependency lockfile for reproducible installs.

## Live database

Applied migration 20260904145256_restore_explicit_scoped_dashboard_access to soncall. It removes broad emergency lead/profile/activity policies, uses explicit assignment/market predicates for activities, and prevents self-service authorization field escalation.

Before and after verification used transactional tests followed by ROLLBACK. Agent self-role escalation and forged activity actor were rejected; legitimate own activity/profile operations and founder team updates passed. Founder retained global visibility; agent visibility was scoped. No customer rows were changed by the migration or retained from tests.

## Verification

- Production Next.js build passed with NEXT_TURBOPACK_EXPERIMENTAL_USE_SYSTEM_TLS_CERTS=1 (local font-download TLS setting only).
- TypeScript passed.
- npm test: 22 tests covering audio authorization/persistence/provider errors, lead access, analytics over 1,000 rows and market scoping, cron authorization.
- git diff --check passed.

## Deployment and remaining validation

The baseline GitHub commit had a failed Vercel deployment. Connected Vercel authorization returns 403 for team alisanmedias-projects; project logs, live environment variables and deployment success require that team's authorization.

OpenAI key validity/quota, a real browser microphone session, and signed-in production agent/manager flows have NOT been verified. No API credentials, real recording contents or customer data were copied into this report. No outbound messages were sent during testing.

This is not an assertion that every workflow is defect-free. Remaining audit findings include broad legacy market-manager policies outside these three tables, public recording storage, exposed legacy progress functions, disabled leaked-password protection, and nontransactional status side effects. Those require separate compatibility verification before changing live behavior.
