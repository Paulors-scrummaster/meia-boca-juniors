# Implementation Plan: MVP Oficial do Meia Boca Juniors

**Branch**: `feature/mbj-mvp-core` (intended) | **Date**: 2026-08-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-mbj-mvp-core/spec.md`

## Summary

Build the MBJ MVP as a responsive, mobile-first React PWA backed by Supabase. Organize the client as a
feature-based modular monolith, keep remote state in TanStack Query and UI-only state in Zustand, and
enforce authorization and critical invariants in PostgreSQL through RLS, constraints, triggers, and
transactional RPC functions. Use versioned lineup and voting records to preserve auditability, keep
offline support read-only and allowlisted, and isolate push, monitoring, and backup integrations behind
adapters or operational workflows. Apply explicit rate limits to authentication and Edge Function
boundaries, monitor production externally, and store four verified encrypted backup sets in a private
Cloudflare R2 bucket.

## Technical Context

**Language/Version**: TypeScript 5.x in strict mode; Node.js 24 LTS for development and CI

**Primary Dependencies**: React, Vite PWA, React Router, Tailwind CSS, shadcn/ui, TanStack Query,
Zustand, React Hook Form, Zod, Supabase JS, OneSignal Web SDK through an adapter, Sentry through an
adapter

**Storage**: Supabase PostgreSQL for relational data; private Supabase Storage buckets for athlete
photos; browser `localStorage` only for the allowlisted next-match and active-lineup query snapshots

**Testing**: Vitest for units, Testing Library for component behavior, Supabase local database tests
for constraints/RLS/RPC, and Playwright for critical end-to-end journeys

**Target Platform**: Responsive browser PWA on current mobile and desktop browsers; installability and
Web Push are progressive enhancements, not prerequisites for core use

**Project Type**: Single web application with managed backend resources in one public repository

**Performance Goals**: Cached next match and active lineup visible within 2 seconds offline; primary
screens show useful state within 2 seconds on a typical mobile connection after authentication;
attendance changes appear to authorized staff without manual refresh; no N+1 query pattern in lists

**Constraints**: R$ 0 incremental monthly infrastructure target; approximately 15 low-frequency users;
single-tenant; Brazilian Portuguese UI; no native app, email delivery, payments, behavioral analytics,
product AI, offline writes, Redis, message broker, or additional ORM; Cloudflare R2 Standard and
UptimeRobot Free usage must remain inside their free allowances

**Scale/Scope**: One club, approximately 15 users accessing two or three times per week, one active
season at a time with preserved historical seasons, low concurrency, and a modular-monolith codebase

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Gate | Pre-design status | Design evidence |
|------|-------------------|-----------------|
| Server-Enforced Security | PASS | RLS on every exposed table; privileged password, invitation, rescheduling, consolidation, reopening, and notification commands use server-side functions; service-role credentials never reach the browser. |
| Domain Integrity and Historical Preservation | PASS | Foreign keys, unique constraints, checks, soft deletion/anonymization, immutable audit records, transactional commands, lineup revisions, and voting rounds preserve consistent history. |
| MVP Simplicity and Controlled Scope | PASS | One React PWA, one Supabase project per environment, one repository, no ORM or extra queue/cache service, and White-Label configuration limited to build-time identity. |
| Automated Quality Gates | PASS | Unit, component, database/RLS, and E2E coverage are assigned by risk; CI gates lint, formatting, typecheck, tests, and build before merge. |
| Resilience, Privacy, and Operability | PASS | Offline cache uses an explicit allowlist and user/version key; writes are blocked offline; external integrations fail gracefully; logs are sanitized; encrypted backups target private R2 with four verified sets; UptimeRobot monitors the canonical app and backup heartbeat. |

No gate exception or unjustified complexity is required.

### Post-design re-check

All five gates remain **PASS** after the data model, contracts, and validation guide. The design adds
only structures needed to implement explicit specification rules. Historical voting rounds and lineup
revisions are justified by the approved reopen/reconsolidate behavior and do not introduce another
service or deployment unit.

## Architecture Decisions

### Client boundaries

- `src/features/*` owns feature UI, query definitions, forms, and service calls.
- `src/shared/*` contains reusable UI, validation primitives, types, adapters, and utilities with no
  feature-specific business rules.
- TanStack Query is the only owner of server state. Query keys are centralized per feature.
- Zustand stores only ephemeral UI state such as menus, modals, selected tab, and theme.
- React Hook Form owns form input state; Zod validates at the client boundary, while the database
  repeats every security or integrity rule that must not be bypassed.
- Supabase, OneSignal, and Sentry SDK calls are contained in adapters/service modules and never called
  directly from visual components.

### Server boundaries

- Ordinary authorized reads use typed Supabase queries against RLS-protected tables or views.
- Simple writes use RLS-protected mutations only when a single row and invariant are sufficient.
- Multi-step or privileged commands use transactional PostgreSQL functions; Edge Functions are used
  only where a server-held secret or external network call is required.
- Authentication identity comes from the validated session. Client-provided user or role identifiers
  are never accepted as authorization evidence.
- Supabase Auth owns e-mail/password throttling. Edge Functions enforce bounded per-actor and
  per-operation limits through private database helpers, return `RATE_LIMITED`, and never retain raw IP
  addresses.
- Realtime subscribes only to the minimal tables/events required by staff attendance views and
  invalidates TanStack queries instead of duplicating server records in local state.

### Rate-limiting boundary

- Supabase Auth owns the configured limits for e-mail/password authentication.
- Application Edge Functions consume private per-actor/per-operation counters before privileged work.
- Initial limits are 10 invitation-management actions per President/hour, 5 administrative password
  resets per President/hour, 10 invitation-acceptance attempts per authenticated user/15 minutes, and
  30 push-identity token requests per authenticated user/hour.
- Internal notification dispatch remains secret-protected and batch-bounded. Rate limiting complements
  RBAC/AAL2 and never replaces authorization.
- Counter subjects are technical UUIDs or keyed hashes; raw IP addresses and personal fields are not
  persisted or logged.

### Transaction boundaries

- `reschedule_match`: update date/time, reset convocations to PENDING, and create notification events.
- `set_match_callups`: atomically reconcile the general called-athlete set, initialize new pending
  presence rows, audit changes, and enqueue one deduplicated event per newly called athlete.
- `respond_to_call`: validate athlete identity, call status, applicable deadline, and reason.
- `admin_set_presence`: enforce role, consolidation lock, and audit the override.
- `publish_lineup`: validate every selected athlete and atomically supersede the prior published
  revision.
- `consolidate_match`: require and snapshot the current published lineup, validate score/contributions,
  update official aggregates, create a 24-hour voting round, and remain idempotent.
- `reopen_match_statistics`: President-only reversal of the current statistics revision, invalidation
  of its voting round/awards, and audit recording.
- `cast_mvp_vote`: enforce voter identity, candidate membership in the published lineup, window, and
  one-vote/no-self-vote constraints.
- `close_mvp_voting`: close an expired round and assign awards to every top-tied candidate.

### Offline and PWA boundaries

- Persist only queries explicitly marked for offline use: next match and current published lineup.
- Use a cache key containing schema version, club identifier, and authenticated user ID; set an expiry
  and purge disk plus memory on sign-out, session invalidation, or user switch.
- Never persist mutations, absence reasons, emails, invitation data, tokens, or administrative views.
- Service Worker runtime caching is limited to versioned static assets. Authenticated Supabase
  responses are not cached by the Service Worker.
- Connectivity UI combines browser network signals with actual request failures. All writes remain
  disabled offline and are never queued.
- Connectivity detection, online-only mutation policy, and the reusable write guard are foundational
  client services so every feature adopts the offline-write boundary when first implemented.

### White-Label boundary

- `club.config.ts` is the typed build-time source for institutional name, logo, text, links, and
  allowlisted semantic CSS variables.
- Components consume semantic design tokens and institutional strings; they do not embed MBJ colors,
  names, or asset paths.
- Public deployment selection may use a non-secret environment identifier. Secrets remain only in
  approved server/CI stores.

## Project Structure

### Documentation (this feature)

```text
specs/001-mbj-mvp-core/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── commands.md
│   ├── events-and-notifications.md
│   └── offline-cache.md
└── tasks.md                    # Created later by $speckit-tasks
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── providers/
│   ├── router/
│   └── layouts/
├── config/
│   ├── club.config.ts
│   └── env.ts
├── features/
│   ├── auth/
│   ├── roster/
│   ├── matches/
│   ├── attendance/
│   ├── lineups/
│   ├── statistics/
│   ├── mvp-voting/
│   ├── notices/
│   └── notifications/
├── shared/
│   ├── adapters/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   ├── types/
│   └── validation/
└── main.tsx

public/
└── brand/

supabase/
├── config.toml
├── migrations/
├── functions/
│   ├── athlete-invitations/
│   ├── admin-reset-password/
│   ├── push-identity/
│   └── dispatch-notifications/
└── tests/
    ├── constraints/
    ├── rls/
    └── rpc/

tests/
├── e2e/
├── fixtures/
└── helpers/

ops/
└── n8n/
    └── README.md

scripts/
└── backup/

docs/
├── backup-restore.md
├── deployment.md
└── operations.md

.github/
└── workflows/
```

**Structure Decision**: Use a single feature-oriented React application plus the standard Supabase
directory in the same repository. Backend behavior is represented by migrations, database tests, and
four narrowly scoped Edge Functions; it is not a separately deployed custom API application.

## Delivery Strategy

1. Establish repository, tooling, environments, CI, base PWA shell, typed config, adapters, and local
   Supabase workflow.
2. Implement authentication, invitations, multi-role authorization, MFA gates, and audit foundation.
3. Implement roster, athlete lifecycle, private images, and historical preservation.
4. Implement matches, convocations, presence responses, exceptional deadlines, realtime staff view,
   and rescheduling transaction.
5. Implement lineup revisions, publication, eligibility, and offline read cache.
6. Implement results, consolidation/reopening, rankings, voting rounds, and tied awards.
7. Implement notices, notification outbox/dispatch, reminders, fallbacks, and operational metrics.
8. Complete accessibility, privacy-safe source-map publication, UptimeRobot monitoring, encrypted R2
   backup automation/runbook, security review, E2E coverage, staging validation, and production release.

Each increment keeps earlier user stories independently demonstrable and leaves production data
isolated from local and preview environments.

## Complexity Tracking

No constitution violations require justification.
