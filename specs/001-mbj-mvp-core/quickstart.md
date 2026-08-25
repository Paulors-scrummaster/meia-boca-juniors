# Quickstart Validation Guide

This guide is the runnable acceptance path for the design. Commands become available as the matching
implementation tasks add project scripts; it intentionally contains no application implementation.

## Prerequisites

- Node.js 24 LTS and npm
- Git and GitHub CLI
- Docker Desktop running
- Supabase CLI installed as a development dependency
- `age` CLI available for backup encryption and restore verification
- A browser supported by Playwright
- Local-only test identities; never copy production users or backups into development

Verify the workstation:

```powershell
node --version
npm --version
git --version
docker version
npx supabase --version
```

## First local setup

From the repository root:

```powershell
npm ci
npx supabase start
npx supabase db reset
npx supabase gen types --lang typescript --local
Copy-Item -LiteralPath '.env.example' -Destination '.env.local'
npm run dev
```

Fill `.env.local` only with the local public URL/key printed by `supabase start`. Never put a remote
service-role key, database password, real invitation, or production player data in this file.

Expected baseline:

- the PWA opens through the local URL;
- the seed creates fictitious President, Coach, multi-role, Athlete, inactive Athlete, matches, and
  presence states;
- public navigation exposes only welcome, login, and invitation acceptance;
- local mail capture may exist for provider testing, but the MBJ product does not send e-mail in its
  normal invitation or password-recovery flows.

## Quality gate

Run the same logical checks required in Pull Requests:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npx supabase db lint
npx supabase test db
npm run build
npm run test:e2e
```

Regenerate database types and confirm the committed file remains current:

```powershell
npm run db:types
git diff --exit-code -- src/shared/types/database.generated.ts
```

## End-to-end validation scenarios

Use the expected roles and command rules in [commands.md](contracts/commands.md) and the relationships
in [data-model.md](data-model.md).

### 1. Invitation and multi-role access

1. Sign in as the seeded President with the second factor completed.
2. Create an athlete and generate an invitation action link.
3. Complete the invited user's account and accept the logical invitation.
4. Assign Coach in addition to Athlete.
5. Inactivate the athlete profile.

Expected:

- the invitation activates once and cannot be reused;
- the user initially receives Athlete permissions;
- inactivation removes Athlete eligibility and frees the shirt number;
- Coach access remains active;
- audit records contain identities/actions but not the invitation token or password.

### 2. Role and MFA denial matrix

Attempt each operation through the UI and a direct test client:

- visitor reads roster;
- Athlete edits another athlete's presence;
- Athlete reads another athlete's reason;
- Coach manages roster or consolidates statistics;
- President without AAL2 performs an administrative command.

Expected: every attempt is denied and reveals no protected row or internal error. Then confirm the
positive counterpart for the allowed role.

### 3. Attendance deadlines and rescheduling

1. Create a future match and call multiple athletes.
2. Repeat the same general call-up command and confirm it creates neither duplicate presences nor
   duplicate `CALL_UP` events.
3. Confirm one and decline another with a reason.
4. Verify another Athlete sees only the declined status, while owner/Coach/President see the reason.
5. Advance test time beyond the general deadline and verify athlete writes fail.
6. Create an exceptional call whose individual deadline ends before kickoff.
7. Change only the location; responses remain.
8. Change date/time; all called responses reset to PENDING and old reasons disappear.

Expected: the staff view updates without manual reload and every reset/override is atomic and audited.

### 4. Lineup publication

1. Create a draft with eligible starters and reserves.
2. Try to add injured, suspended, inactive, and declined athletes.
3. Publish the valid draft, edit it as a new revision, and republish.

Expected: ineligible additions fail; only one published revision is current; the prior revision remains
historical; one notification event exists per publication revision.

### 5. Consolidation, vote, and correction

1. Complete a match and consolidate a score with matching goal contributions.
2. Repeat with the same idempotency key.
3. Publish a newer lineup after consolidation and confirm the voting candidates remain tied to the
   immutable lineup revision captured by the consolidation.
4. Vote as an Athlete; try self-vote, duplicate vote, late vote, and a candidate outside the published
   lineup.
5. Create a top tie and close the round.
6. Reopen as President, correct the result, and reconsolidate.

Expected:

- retry creates no duplicate statistics/event;
- invalid votes fail;
- every top-tied candidate receives an award;
- reopening invalidates the prior consolidation, votes, and awards without deleting history;
- the new consolidation opens a fresh 24-hour round and rankings use only the current revision.

### 6. Offline privacy and write blocking

Follow [offline-cache.md](contracts/offline-cache.md):

1. Load next match and published lineup as user A.
2. Disconnect the browser and reload.
3. Inspect UI, local storage, service-worker caches, and pending mutation state.
4. Attempt confirm, decline, and vote.
5. Log out, sign in as user B, and stay offline.

Expected:

- allowed data appears in under 2 seconds with offline/last-updated indicators;
- no reason, e-mail, token, invite, audit, or unrelated query is persisted;
- all writes fail before submission and none replay after reconnect;
- user A data is purged and never appears to user B;
- authenticated API responses do not exist in Service Worker Cache Storage.

### 7. Notification failure

1. Run the provider adapter in forced-failure mode.
2. Create a call, publish a lineup, consolidate a match, and publish a notice.
3. Restore the adapter and run the bounded retry worker.
4. Trigger the invitation, reset-password, invitation-acceptance, and push-identity limits and confirm
   each returns `RATE_LIMITED` without raw IP, e-mail, or token data in logs.

Expected: every business operation succeeds, in-app pending information remains correct, delivery
states record safe errors, and retries do not duplicate a recipient notification.

## PWA and preview validation

On a Cloudflare preview connected only to staging:

- reload a deep React route and confirm SPA fallback;
- confirm production OneSignal is not initialized;
- verify HTML, manifest, root PWA worker, and scoped OneSignal worker MIME/cache behavior;
- confirm API/Auth responses are excluded from Service Worker Cache Storage;
- validate keyboard, focus, contrast, screen-reader labels, and touch targets;
- confirm preview/staging contains no production identity or player data.

On the canonical production domain before inviting players:

- verify every `pages.dev` alias redirects while preserving path/query;
- install the PWA and validate prompted updates do not discard a filled form;
- on a supported iPhone/iPad, install to Home Screen, open from the icon, request push after a user
  gesture, then receive/open a test notification;
- verify Sentry reports use the deployment commit as release and contain no personal fields.
- verify source maps resolve errors in Sentry but no `.map` file is publicly retrievable from `dist`;
- verify the UptimeRobot HTTP/keyword monitor reports the canonical URL healthy and delivers a tested
  outage alert to the project owner.

## Backup and migration gate

Before a critical production migration:

1. Trigger the authenticated n8n pre-migration workflow.
2. Require a verified response containing backup ID and checksum.
3. Confirm the set contains roles, schema, data, Storage objects, and manifest, is encrypted locally
   with `age`, and exists only as a private object in the `mbj-backups` R2 bucket.
4. Run migration dry-run, then apply only when the backup gate passes.
5. Execute smoke reads and the relevant database/E2E tests.

Monthly, restore the newest set into an isolated local/staging target and record duration, table counts,
Auth continuity, and a sample avatar checksum. A failed backup or restore test blocks destructive
schema work. The weekly workflow must complete its external heartbeat only after remote checksum
verification and retention of four complete sets.

## Shutdown

```powershell
npx supabase stop
```

Do not use destructive cleanup flags unless local data is intentionally disposable and separately
confirmed.
