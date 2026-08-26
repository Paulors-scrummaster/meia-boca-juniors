# Research: MVP Oficial do Meia Boca Juniors

All research decisions preserve the approved `TECH_STACK.md` and Constitution. Sources are official
project/vendor documentation current at planning time.

## 1. Integrated Supabase backend

**Decision**: Use PostgreSQL as the source of truth, Supabase Auth for identity, RLS-protected Data API
for ordinary access, PostgreSQL RPC for atomic transitions, private Storage for avatars, Realtime for
targeted invalidation, and Edge Functions only for secrets/Auth Admin/external push.

**Rationale**: This is the smallest architecture that supplies the relational integrity, authorization,
files, realtime updates, and privileged execution required by the spec for approximately 15 users.
[Supabase database overview](https://supabase.com/docs/guides/database/overview)

**Alternatives considered**: A custom API server, ORM, Redis, broker, or microservices add operational
cost and duplicate managed Supabase capabilities. They are rejected for the MVP.

## 2. Invitation without product e-mail

**Decision**: Disable open signup. A President+AAL2 Edge Function creates/refreshes a logical invitation
and calls the Auth Admin link-generation API. The returned short-lived action link is delivered manually
through WhatsApp. Final acceptance locks the invitation, matches the authenticated Auth user to the
expected logical invitation, and links the athlete exactly once.

**Rationale**: Auth Admin secrets remain server-side and the product sends no e-mail. The logical invite
can remain valid until redemption/revocation while each physical Auth action link keeps its provider
expiry; “resend” produces a fresh delivery link. Auth Admin and PostgreSQL are not one distributed
transaction, so create/revoke/retry operations must be idempotent and track intermediate state.
[Supabase users and invitations](https://supabase.com/docs/guides/auth/users),
[generateLink reference](https://supabase.com/docs/reference/javascript/auth-admin-generatelink),
[securing Edge Functions](https://supabase.com/docs/guides/functions/auth)

**Alternatives considered**: `inviteUserByEmail` requires outbound e-mail and SMTP; open signup weakens
the invitation boundary; a browser-held admin key is prohibited.

## 3. Relational RBAC, RLS, and MFA

**Decision**: Store additive roles in `user_roles`. RLS checks active account, role, ownership, and AAL2
where administrative. Keep helper functions in a private schema with pinned empty `search_path`, fully
qualified names, minimal execute grants, and operation-specific policies using both `USING` and
`WITH CHECK` where applicable.

**Rationale**: Relational roles make revocation immediate and handle President+Athlete combinations
without waiting for a JWT refresh. User-editable metadata is not authorization evidence. AAL2 is a
server-verifiable requirement for President/Coach commands.
[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[Supabase MFA assurance levels](https://supabase.com/docs/guides/auth/auth-mfa)

**Alternatives considered**: Custom role arrays in JWT claims are viable at higher scale but become
stale until refresh. They are unnecessary for one small club.

## 4. Protected absence reasons

**Decision**: Store absence reasons separately from roster-visible presence state. The owner,
President, and Coach can select the protected row; other athletes receive only the status projection.

**Rationale**: RLS controls rows, not arbitrary columns returned from the same exposed row. Separation
makes the approved privacy boundary simple to prove with negative tests.

**Alternatives considered**: A single table plus client hiding is insecure. A carefully restricted view
could work, but separate storage makes accidental direct-table exposure less likely.

## 5. Immutable revisions and transactional commands

**Decision**: Store published lineup versions and match consolidation revisions immutably. The match
points to the current valid consolidation; goals, voting round, votes, and awards belong to that
revision. Reopening invalidates the pointer/revision rather than subtracting mutable season counters.
Use row locks, idempotency keys, audit writes, and notification outbox inserts inside transactional
PostgreSQL functions.

**Rationale**: Repeated requests cannot duplicate statistics, and reopening retains a complete history.
Rankings filter the current valid revision, so rollback is deterministic.
[Supabase database functions](https://supabase.com/docs/guides/database/functions)

**Alternatives considered**: Mutable aggregate counters are simpler initially but hard to reverse
safely. Deleting old votes/statistics loses auditability.

## 6. Realtime as query invalidation

**Decision**: Use Postgres Changes only for small, nonsensitive change signals such as matches,
presence state, current lineup pointer, and notices. Events invalidate TanStack queries; they do not
become another application state store. Do not publish invitation, justification, or audit tables.

**Rationale**: Postgres Changes is sufficient at this scale and avoids custom channel infrastructure.
[Supabase Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)

**Alternatives considered**: Private Broadcast scales better but needs more triggers and channel
authorization. Reconsider only after measured need.

## 7. Private avatar storage

**Decision**: Use private bucket `athlete-avatars`, object path
`athletes/{athlete_id}/avatar.webp`, 1 MB maximum, image MIME allowlist, and 1024×1024 maximum output.
Authorized users read through authenticated download or short-lived signed URL; authorized staff can
write on behalf of an athlete.

**Rationale**: Private buckets enforce access control and avoid permanent public profile-image URLs.
Storage objects are managed through the Storage API, never direct schema mutation.
[Storage bucket fundamentals](https://supabase.com/docs/guides/storage/buckets/fundamentals),
[Storage access control](https://supabase.com/docs/guides/storage/security/access-control)

**Alternatives considered**: Public buckets simplify rendering but expose the complete roster's photos.

## 8. Transactional notification outbox

**Decision**: Business commands insert minimal `notification_events` in the same database transaction.
An Edge Function dispatches through a OneSignal adapter and records idempotent per-user deliveries.
Scheduled 24-hour and 6-hour reminders use a deterministic key containing presence, schedule revision,
call revision, and reminder kind. General and exceptional call commands stamp `called_at`, increment
`call_revision` on every legitimate re-call, and create one event per new call revision. Supabase Cron
scans every 5 minutes, and each reminder is eligible only from its target instant through 10 minutes
after it; targets before `called_at` and missed windows are skipped.

**Rationale**: A push outage never rolls back a match or attendance action, while deduplication and
delivery metrics remain observable without a dedicated queue.
[Supabase Cron](https://supabase.com/docs/guides/cron),
[scheduled Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)

**Alternatives considered**: Sending push inside the main client request couples user success to an
external provider. A message broker is excessive for the volume.

## 9. Allowlisted TanStack offline persistence

**Decision**: Use `PersistQueryClientProvider` with the synchronous local-storage persister. Persist
only sanitized next-match and published-lineup DTOs through `shouldDehydrateQuery`; never persist
mutations. Key by cache version, club, and user. Initial `maxAge` is 24 hours with `gcTime` at least as
long; show last update and clear memory plus disk on logout/user change/session revocation.

**Rationale**: Two small documents fit local storage, the provider prevents restore/fetch races, and an
allowlist is auditable. Mutations remain immediate online-only attempts with no paused replay.
[TanStack persistQueryClient](https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient),
[sync storage persister](https://tanstack.com/query/latest/docs/framework/react/plugins/createSyncStoragePersister),
[TanStack network mode](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode)

**Alternatives considered**: IndexedDB is unnecessary at this size. Experimental per-query persistence
and offline-first mutations add instability or conflict resolution outside scope.

## 10. Safe PWA service-worker policy

**Decision**: Use `vite-plugin-pwa` with generated Workbox worker, prompt-based upgrades, navigation
fallback, and precache only for the app shell/hash assets. Auth/API routes are NetworkOnly or excluded
from runtime caching. The service worker does not duplicate TanStack's business-data cache.

**Rationale**: Authenticated responses never enter Cache Storage, and a prompted upgrade does not
silently reload a partially completed form.
[Vite PWA service-worker strategies](https://vite-pwa-org.netlify.app/guide/service-worker-strategies-and-behaviors),
[prompt for update](https://vite-pwa-org.netlify.app/guide/prompt-for-update.html),
[Workbox caching strategies](https://developer.chrome.com/docs/workbox/caching-strategies-overview/)

**Alternatives considered**: `injectManifest` is reserved for a proven custom-worker need. Broad API
runtime caching is rejected for privacy and duplicate-state reasons.

## 11. OneSignal and PWA coexistence

**Decision**: Initialize production push only on the canonical custom domain. Keep the PWA worker at
root and OneSignal's stable public worker under `/push/onesignal/` with its own scope. Use contextual
soft prompts and a dedicated authenticated `push-identity` Edge Function that derives the technical
user ID from the session and returns a short-lived signed verification token. Push remains optional;
in-app pending indicators are authoritative fallback.

**Rationale**: Push subscriptions are origin-bound. Separate worker scopes reduce coupling. On
iOS/iPadOS, Web Push requires 16.4+, installation to the Home Screen, opening from the icon, and a
user gesture before permission.
[OneSignal service worker](https://documentation.onesignal.com/docs/en/onesignal-service-worker),
[OneSignal Web SDK](https://documentation.onesignal.com/docs/en/web-sdk-setup),
[OneSignal iOS Web Push](https://documentation.onesignal.com/docs/en/web-push-for-ios),
[OneSignal identity verification](https://documentation.onesignal.com/docs/en/identity-verification)

**Alternatives considered**: A single combined worker increases lifecycle complexity. Push on preview
origins fragments subscriptions and is disabled.

## 12. Typed White-Label configuration

**Decision**: Use a typed `club.config.ts` for institutional identity and an allowlist of semantic
shadcn/Tailwind CSS variables. Components consume semantic tokens. Environment variables may select a
public config but contain no branding object or secret.

**Rationale**: This provides compile-time completeness and prevents arbitrary CSS injection while
matching future build/origin-per-club multi-instance deployment.
[shadcn theming](https://ui.shadcn.com/docs/theming),
[Tailwind theme variables](https://tailwindcss.com/docs/theme),
[Vite environment variables](https://vite.dev/guide/env-and-mode)

**Alternatives considered**: Dynamic Tailwind class construction is brittle; database-driven arbitrary
CSS is unnecessary and unsafe; `.env` is public in the browser and poorly suited to structured data.

## 13. Layered, risk-based testing

**Decision**: Vitest+Testing Library cover pure rules, validation, hooks, and visible component behavior;
Supabase local+pgTAP prove schema, constraints, RLS, MFA, and RPC; Playwright covers critical browser
journeys. PR E2E gates Chromium desktop/mobile with one CI worker and artifacts on failure; broader
browser coverage may run on `main` or scheduled workflows.

**Rationale**: Security policies fail most clearly at the database layer, while user journeys require a
real browser. Accessible-role queries are preferred over test IDs.
[Supabase database testing](https://supabase.com/docs/guides/database/testing),
[Testing Library queries](https://testing-library.com/docs/queries/about/),
[Playwright CI](https://playwright.dev/docs/ci),
[Vitest coverage](https://vitest.dev/guide/coverage.html)

**Alternatives considered**: E2E-only RLS coverage is slow and poor at localizing policy failures.
Global 100% code coverage is rejected in favor of explicit risk coverage.

## 14. CI, preview, and compatible database rollout

**Decision**: Create the public GitHub repository with a neutral bootstrap README on `main`; no project
commit is pushed directly to that branch. Publish the project only as `feature/mbj-mvp-core`, open its
Pull Request, let GitHub register the CI checks, and configure the `main` ruleset before any project
merge. The ruleset requires Pull Requests, passing checks, and documented Codex-assisted self-review
while blocking direct project pushes. GitHub Actions runs frontend quality, database security, then E2E
jobs. Cloudflare Pages keeps native Git previews and `main` production deployment. Preview uses staging
data only. Database migrations use a separate workflow, verified pre-migration backup, dry run, and
forward-compatible expand/contract changes.

**Rationale**: A neutral remote bootstrap allows the first project change to follow the same protected
Pull Request path required for every later change, avoiding an unprotected project push to `main`.
Native Pages previews are simple, but Pages publication and database workflows have no strict mutual
ordering. Backward-compatible migrations keep both old and new PWA bundles working.
[GitHub Node.js CI](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs),
[Cloudflare Pages Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/),
[Supabase migrations](https://supabase.com/docs/guides/deployment/database-migrations)

**Alternatives considered**: Publishing Pages through a fully ordered custom workflow would add a
Cloudflare token and operational complexity. Reconsider only if expand/contract becomes insufficient.

## 15. Cloudflare canonical-origin behavior

**Decision**: `main` builds with `npm run build` to `dist`. Do not add a root `404.html`, allowing Pages
SPA fallback. Register the custom subdomain through Pages first, redirect `pages.dev` aliases to the
canonical domain, and verify that the manifest and both workers are real JavaScript/manifest responses,
not SPA fallbacks. Avoid broad custom cache rules.

**Rationale**: One canonical origin prevents split Auth/PWA/push state. Cloudflare's default asset cache
already handles hashed deploys.
[Cloudflare React deployment](https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/),
[Pages serving behavior](https://developers.cloudflare.com/pages/configuration/serving-pages/),
[custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)

**Alternatives considered**: Manual DNS before Pages registration and broad caching rules create
certificate or stale-deploy risk.

## 16. Privacy-conscious Sentry

**Decision**: Enable Sentry in staging/production only, default PII off, no Session Replay, low
performance sampling, and a `beforeSend` scrubber for authorization, tokens, invites, reasons, names,
and e-mails. Identify users only by technical UUID and role. Upload source maps in CI, then exclude them
from public output. Edge Functions use request-local scope and flush errors before response completion.

**Rationale**: This supplies actionable errors and trace IDs without turning monitoring into a personal
data store.
[Sentry React options](https://docs.sentry.io/platforms/javascript/guides/react/configuration/options/),
[Sentry Vite source maps](https://docs.sentry.io/platforms/javascript/guides/react/sourcemaps/uploading/vite/),
[Supabase Edge Function Sentry example](https://supabase.com/docs/guides/functions/examples/sentry-monitoring)

**Alternatives considered**: Session Replay adds privacy surface without proportional value for 15
users. Full distributed tracing is outside scope.

## 17. Verified external backups

**Decision**: Self-hosted n8n orchestrates weekly and authenticated manual triggers from a sanitized,
versioned `ops/n8n/backup-workflow.json`, but does not execute repository scripts itself. It dispatches
and polls a reusable `.github/workflows/backup.yml` on a pinned Windows runner through a fine-grained
GitHub credential stored only in n8n Credentials. The runner installs pinned Supabase CLI and `age`
versions, invokes the fixed allowlisted PowerShell script, exports roles/schema/data, separately
downloads Storage objects, builds a manifest/checksum, encrypts before upload, uploads to the private
Cloudflare R2 Standard bucket `mbj-backups`, verifies the remote object, removes plaintext temporary
artifacts, then retains the latest four complete sets. The production migration workflow invokes the
same reusable backup workflow directly and blocks until it receives a verified backup ID/checksum.
Failure alerts and monthly isolated restore tests are mandatory; local CLI remains the contingency
path. Supabase/R2/age secrets stay in a protected GitHub environment, the n8n credential is scoped only
to dispatch/read Actions for this repository, workflow exports contain no credential IDs or values,
and the decryption private key remains outside n8n, GitHub, and Git in the owner's recovery custody.

**Rationale**: The already-approved GitHub Actions service supplies an ephemeral, reproducible Windows
execution environment without assuming the operating system, installed tools, filesystem, or Docker
permissions of the n8n host. Supabase recommends off-site CLI exports for Free projects, and database
dumps do not contain physical Storage objects. Retention only after verification avoids deleting the
last good set.
[Supabase backups](https://supabase.com/docs/guides/platform/backups),
[Supabase CLI backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore),
[Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/),
[Cloudflare R2 durability](https://developers.cloudflare.com/r2/reference/durability/),
[n8n encryption key](https://docs.n8n.io/hosting/configuration/configuration-examples/encryption-key/),
[n8n error handling](https://docs.n8n.io/flow-logic/error-handling/)

**Alternatives considered**: Installing PowerShell, Supabase CLI, `age`, and repository mounts inside
the n8n host couples backup reliability to an unknown deployment environment; mounting the Docker
socket adds unnecessary privilege. Database-only backup loses avatars; repository backups expose
personal data; manual-only exports are too easy to forget; paid managed backup is unnecessary at MVP
scale. Google Drive would work through n8n but R2 keeps the workflow S3-compatible and inside the
already approved Cloudflare account while remaining within the small-project free allowance.

## 18. Layered rate limiting

**Decision**: Keep login throttling in Supabase Auth, explicitly disable open sign-up, and declare the
initial local `auth.rate_limit.sign_in_sign_ups = 30` five-minute/IP window in `supabase/config.toml`.
Verify the equivalent non-secret setting in hosted staging and production through the Dashboard or
Management API. Add private fixed-window per-actor counters for invitation management, invitation
acceptance, administrative password reset, and push-identity token issuance. Every boundary maps an
HTTP 429 to the stable Portuguese `RATE_LIMITED` error and supplements rather than replaces RBAC/AAL2.
Counter keys use technical UUIDs or keyed hashes, never raw IP addresses or e-mails.

**Rationale**: The small authenticated workload does not justify another service, while privileged
Edge Functions still need explicit abuse bounds and deterministic tests.
[Supabase Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits),
[Supabase CLI configuration](https://supabase.com/docs/guides/local-development/cli/config)

**Alternatives considered**: Redis or a dedicated rate-limit SaaS adds infrastructure outside the MVP;
client-only throttling is bypassable; raw-IP logging expands privacy exposure.

## 19. External production and backup monitoring

**Decision**: Use UptimeRobot Free for a 5-minute HTTP/keyword monitor of the canonical production URL
and a heartbeat monitor completed by the weekly n8n backup workflow. Alerts go to the project owner.

**Rationale**: An external monitor can detect an unavailable webapp or stalled backup independently of
Cloudflare, Supabase, n8n, and Sentry application reporting, while staying inside the zero-cost target.
[UptimeRobot free-plan monitoring](https://help.uptimerobot.com/en/articles/11604710-who-should-use-uptimerobot-s-free-plan)

**Alternatives considered**: Cloudflare standalone Health Checks are not included in the Free plan;
an n8n-only check cannot alert when the self-hosted n8n instance itself is unavailable.
