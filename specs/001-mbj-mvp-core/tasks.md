# Tasks: MVP Oficial do Meia Boca Juniors

**Input**: Design documents from `/specs/001-mbj-mvp-core/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`, `.specify/memory/constitution.md`

**Tests**: Automated tests are mandatory because the specification defines acceptance scenarios and the Constitution requires risk-based coverage of every critical journey.

**Organization**: Tasks are grouped by user story so each increment can be implemented, validated, and demonstrated independently after its declared dependencies.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files and has no dependency on another incomplete task in the same group
- **[Story]**: Maps the task to a user story from `spec.md`
- Every task names the exact file or files it must create or modify

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the public repository, React PWA, development tooling, and local Supabase workspace.

- [ ] T001 Initialize the Git repository and create the `feature/mbj-mvp-core` branch recorded in `.git/HEAD`
- [ ] T002 Create repository-safe ignore rules for secrets, dumps, generated output, and local Supabase state in `.gitignore`
- [ ] T003 Initialize the Vite React TypeScript application and commit the dependency manifest in `package.json`
- [ ] T004 [P] Define local-only public configuration placeholders without secrets in `.env.example`
- [ ] T005 [P] Configure strict TypeScript and import aliases in `tsconfig.json` and `tsconfig.app.json`
- [ ] T006 [P] Configure Vite, React, and the production build in `vite.config.ts`
- [ ] T007 [P] Configure ESLint and Prettier quality rules in `eslint.config.js` and `.prettierrc.json`
- [ ] T008 Install and configure Tailwind CSS plus semantic shadcn/ui tokens in `src/index.css` and `components.json`
- [ ] T009 Create the application entry point and provider composition boundary in `src/main.tsx` and `src/app/App.tsx`
- [ ] T010 [P] Implement validated public environment parsing in `src/config/env.ts`
- [ ] T011 [P] Implement the typed MBJ White-Label identity, institutional text, links, logos, semantic theme allowlist, and approved formation mirror in `src/config/club.config.ts`
- [ ] T012 [P] Add initial brand assets, favicon, and PWA icons in `public/brand/logo.svg`, `public/favicon.svg`, and `public/pwa-192x192.png`
- [ ] T013 Configure the local Supabase project and fictitious seed entry point in `supabase/config.toml` and `supabase/seed.sql`
- [ ] T014 [P] Configure Vitest, Testing Library, and shared browser mocks in `vitest.config.ts` and `src/test/setup.ts`
- [ ] T015 [P] Configure Playwright projects for desktop and mobile Chromium in `playwright.config.ts`
- [ ] T016 Add reproducible format, lint, typecheck, unit, database, E2E, build, and database-type scripts in `package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the security, database, client-state, routing, testing, and CI foundations required by every user story.

**⚠️ CRITICAL**: No user story implementation starts until this phase passes its database and frontend checks.

- [ ] T017 Create domain enums, `profiles`, additive `user_roles`, the core `athletes` identity table, and immutable `audit_logs` with explicit constraints and foreign-key behavior in `supabase/migrations/20260825000100_foundation.sql`
- [ ] T018 Create private authorization, AAL2, safe audit, and fixed-window rate-limit helpers with pinned search paths and no raw-IP storage in `supabase/migrations/20260825000200_authorization_helpers.sql`
- [ ] T019 Create the generic idempotent notification outbox tables needed by transactional commands in `supabase/migrations/20260825000300_notification_outbox.sql`
- [ ] T020 [P] Add pgTAP constraint tests for profiles, core athletes, additive roles, rate counters, audit immutability, and notification deduplication in `supabase/tests/constraints/001_foundation.test.sql`
- [ ] T021 [P] Add positive and negative RLS tests for active accounts, role union, AAL2 checks, private rate counters, audit denial, and outbox privacy in `supabase/tests/rls/001_foundation_rls.test.sql`
- [ ] T022 Generate the foundational database bindings and create the repeatable drift-check command in `src/shared/types/database.generated.ts` and `scripts/generate-database-types.ps1`
- [ ] T023 Implement the browser-safe Supabase client adapter with no service-role path in `src/shared/adapters/supabase/client.ts`
- [ ] T024 [P] Define stable Portuguese application errors, field errors, and trace-ID mapping in `src/shared/lib/app-error.ts`
- [ ] T025 [P] Define centralized typed status labels and São Paulo date/time formatting helpers in `src/shared/lib/domain-labels.ts` and `src/shared/lib/date-time.ts`
- [ ] T026 Configure the TanStack Query client, retry policy, and server-state provider in `src/app/providers/QueryProvider.tsx`
- [ ] T027 Implement authenticated-session resolution and account-change boundaries in `src/app/providers/AuthProvider.tsx`
- [ ] T028 Implement public, authenticated, role-protected, and AAL2-protected route guards in `src/app/router/guards.tsx`
- [ ] T029 Define the route tree for public and authenticated modules in `src/app/router/router.tsx`
- [ ] T030 [P] Create accessible shared loading, error, empty-state, confirmation, and toast components in `src/shared/components/feedback.tsx`
- [ ] T031 [P] Implement connectivity state combining browser signals and real request failures in `src/shared/hooks/use-connectivity.ts`
- [ ] T032 [P] Implement the zero-retry online-only mutation policy with no paused replay in `src/shared/hooks/use-online-mutation.ts`
- [ ] T033 [P] Implement the reusable accessible write-control guard and reconnection explanation in `src/shared/components/OnlineActionGuard.tsx`
- [ ] T034 Create the responsive mobile-first authenticated shell and navigation driven by effective roles in `src/app/layouts/AuthenticatedLayout.tsx`
- [ ] T035 Seed fictitious President, Coach, multi-role, Athlete, inactive Athlete, season, and baseline match records in `supabase/seed.sql`
- [ ] T036 Add GitHub Actions gates for format, lint, typecheck, unit tests, Supabase lint/tests, generated-type drift, build, and Playwright artifacts in `.github/workflows/ci.yml`

**Checkpoint**: The application shell starts locally, security helpers and RLS tests pass, and CI can validate an empty authenticated feature route.

---

## Phase 3: User Story 1 - Acesso seguro por convite e papéis (Priority: P1) 🎯 First Deliverable

**Goal**: Allow only individually invited people to activate an account, sign in, satisfy MFA for administrative work, and receive the union of their active roles.

**Independent Test**: Pre-create an athlete, issue and redeem one invitation, sign in, assign multiple roles, exercise the denial matrix, and verify invite reuse plus unauthenticated protected access are blocked.

### Tests for User Story 1

- [ ] T037 [P] [US1] Add pgTAP constraints for one active logical invite per athlete, single redemption, and sanitized audit data in `supabase/tests/constraints/002_identity_invites.test.sql`
- [ ] T038 [P] [US1] Add RLS and RPC denial-matrix tests for visitors, Athlete, Coach, President, disabled accounts, and missing AAL2 in `supabase/tests/rls/002_identity_roles_rls.test.sql`
- [ ] T039 [P] [US1] Add Edge Function contract tests for invitation management, acceptance, administrative reset, approved rate limits, and safe `RATE_LIMITED` failures in `supabase/functions/tests/identity-functions.test.ts`
- [ ] T040 [P] [US1] Add component tests for login, forced password change, invitation acceptance, role navigation, and MFA prompts in `src/features/auth/auth-flows.test.tsx`
- [ ] T041 [P] [US1] Add the invitation, multi-role, MFA, and forbidden-direct-request browser journey in `tests/e2e/auth-invitation.spec.ts`

### Implementation for User Story 1

- [ ] T042 [US1] Create `athlete_invites`, invitation lifecycle constraints, profile activation operations, and President-only role assignment policies in `supabase/migrations/20260825000400_identity_invites.sql`
- [ ] T043 [US1] Regenerate and verify Supabase bindings after identity migrations in `src/shared/types/database.generated.ts`
- [ ] T044 [P] [US1] Implement common Edge Function authentication, AAL2, idempotency, rate-limit consumption, CORS, safe-error, and trace helpers in `supabase/functions/_shared/security.ts`
- [ ] T045 [US1] Implement create, resend, and revoke operations using Auth Admin link generation, approved per-President limits, and no product e-mail in `supabase/functions/athlete-invitations/index.ts`
- [ ] T046 [US1] Implement single-use invitation acceptance and atomic athlete/profile/role linkage in `supabase/functions/athlete-invitations/accept.ts`
- [ ] T047 [US1] Implement President+AAL2 temporary-password reset, forced-change flag, session handling, sanitized audit, and five-per-hour actor limit in `supabase/functions/admin-reset-password/index.ts`
- [ ] T048 [US1] Implement typed auth, invitation, MFA enrollment/challenge, role, logout, and password-change service calls in `src/features/auth/api/auth.service.ts`
- [ ] T049 [P] [US1] Implement e-mail/password login and public welcome screens in `src/features/auth/pages/LoginPage.tsx` and `src/features/auth/pages/WelcomePage.tsx`
- [ ] T050 [P] [US1] Implement invitation validation, confirmed athlete identity, and account activation UI in `src/features/auth/pages/AcceptInvitationPage.tsx`
- [ ] T051 [P] [US1] Implement forced temporary-password replacement UI with React Hook Form and Zod in `src/features/auth/pages/ChangePasswordPage.tsx`
- [ ] T052 [P] [US1] Implement TOTP enrollment and AAL2 challenge UI for President and Coach in `src/features/auth/pages/MfaPage.tsx`
- [ ] T053 [US1] Implement effective-role queries and President role-assignment controls in `src/features/auth/queries/roles.queries.ts` and `src/features/auth/components/RoleManager.tsx`
- [ ] T054 [US1] Register public/authenticated/MFA/password-change routes and role-aware redirects in `src/app/router/router.tsx`

**Checkpoint**: User Story 1 is independently usable and all server-side authorization denials pass without relying on hidden UI controls.

---

## Phase 4: User Story 2 - Gestão do elenco e preservação do histórico (Priority: P1)

**Goal**: Let the President manage sporting profiles, private optimized avatars, states, and logical removal while preserving history and unrelated roles.

**Independent Test**: Create and edit athletes, reject a duplicate active shirt number, optimize an avatar, inactivate a multi-role athlete, reuse the released number, and verify historical records remain visible.

### Tests for User Story 2

- [ ] T055 [P] [US2] Add pgTAP tests for athlete states, partial shirt-number uniqueness, inactivation timestamps, anonymization, and historical foreign keys in `supabase/tests/constraints/003_roster.test.sql`
- [ ] T056 [P] [US2] Add RLS tests for roster reads, President-only mutations, private avatar objects, and preservation of Coach/President roles on athlete inactivation in `supabase/tests/rls/003_roster_rls.test.sql`
- [ ] T057 [P] [US2] Add unit and component tests for initials, image validation/optimization, roster filters, and athlete forms in `src/features/roster/roster.test.tsx`
- [ ] T058 [P] [US2] Add the create/edit/inactivate/history/number-reuse browser journey in `tests/e2e/roster-management.spec.ts`

### Implementation for User Story 2

- [ ] T059 [US2] Complete athlete length/lifecycle constraints, private `athlete-avatars` bucket policies, and audited President mutations in `supabase/migrations/20260825000500_roster.sql`
- [ ] T060 [US2] Implement atomic athlete inactivation/anonymization that releases the number and removes only the Athlete role in `supabase/migrations/20260825000600_roster_lifecycle_functions.sql`
- [ ] T061 [US2] Regenerate and verify Supabase bindings after roster migrations in `src/shared/types/database.generated.ts`
- [ ] T062 [P] [US2] Implement client-side image validation, crop/resize, WebP optimization, and 1 MB/1024px limits in `src/features/roster/lib/optimize-avatar.ts`
- [ ] T063 [P] [US2] Implement deterministic initials and club-themed avatar fallback in `src/features/roster/components/AthleteAvatar.tsx`
- [ ] T064 [US2] Implement typed roster queries, private signed-avatar access, and President mutations in `src/features/roster/api/roster.service.ts` and `src/features/roster/queries/roster.queries.ts`
- [ ] T065 [P] [US2] Implement the accessible roster list and status presentation in `src/features/roster/pages/RosterPage.tsx`
- [ ] T066 [P] [US2] Implement the sporting profile and preserved history view in `src/features/roster/pages/AthleteProfilePage.tsx`
- [ ] T067 [US2] Implement President create/edit/status/anonymization forms with React Hook Form and Zod in `src/features/roster/components/AthleteForm.tsx`
- [ ] T068 [US2] Register roster list, detail, and President management routes in `src/app/router/router.tsx`

**Checkpoint**: User Story 2 preserves sporting history, never exposes public avatar URLs, and keeps non-Athlete roles intact during inactivation.

---

## Phase 5: User Story 3 - Partidas, convocações e presença (Priority: P1)

**Goal**: Let staff schedule and manage matches/call-ups while athletes answer before the applicable deadline and staff receive realtime state changes with protected refusal reasons.

**Independent Test**: Create a match, call athletes, confirm and decline, test reason privacy and closed deadlines, create an exceptional call, reschedule atomically, and observe the staff view update without manual refresh.

### Tests for User Story 3

- [ ] T069 [P] [US3] Add pgTAP tests for seasons, match deadlines, unique presence rows, exceptional deadlines, refusal reasons, states, and historical delete behavior in `supabase/tests/constraints/004_matches_attendance.test.sql`
- [ ] T070 [P] [US3] Add RLS tests for own answers, protected justification visibility, staff rights, consolidation locks, cancelled matches, and direct-request deadline denial in `supabase/tests/rls/004_attendance_rls.test.sql`
- [ ] T071 [P] [US3] Add RPC tests for general call-up reconciliation/event deduplication, idempotent response, administrative override, exceptional call, descriptive edit, date/time reset, and concurrent writes in `supabase/tests/rpc/001_attendance_commands.test.sql`
- [ ] T072 [P] [US3] Add unit/component tests for deadline rendering, refusal validation, offline-independent UI denial, and staff state updates in `src/features/attendance/attendance.test.tsx`
- [ ] T073 [P] [US3] Add the match, attendance, reason privacy, exceptional call, realtime, cancellation, and rescheduling journey in `tests/e2e/matches-attendance.spec.ts`

### Implementation for User Story 3

- [ ] T074 [US3] Create `seasons`, `matches`, `match_presences`, and protected `presence_justifications` with constraints and RLS in `supabase/migrations/20260825000700_matches_attendance.sql`
- [ ] T075 [US3] Implement `respond_to_call` with caller identity, applicable deadline, reason privacy, idempotency, and atomic status transition in `supabase/migrations/20260825000800_respond_to_call.sql`
- [ ] T076 [US3] Implement `admin_set_presence` with AAL2, consolidation lock, explanation, and sanitized audit in `supabase/migrations/20260825000900_admin_set_presence.sql`
- [ ] T077 [US3] Implement `reschedule_match` and cancel/reactivate commands with row locks, schedule revisions, conditional reset, reason cleanup, and outbox events in `supabase/migrations/20260825001000_match_lifecycle_commands.sql`
- [ ] T078 [US3] Implement `create_exceptional_call` with deadline and athlete eligibility enforcement in `supabase/migrations/20260825001100_exceptional_calls.sql`
- [ ] T079 [US3] Implement transactional `set_match_callups` with idempotency, audit, presence reconciliation, and deduplicated `CALL_UP` events in `supabase/migrations/20260825001150_set_match_callups.sql`
- [ ] T080 [US3] Create minimal-invoker `next_match_view`, roster-visible presence projection, protected `staff_attendance_view`, and Realtime publication allowlist in `supabase/migrations/20260825001200_attendance_views_realtime.sql`
- [ ] T081 [US3] Regenerate and verify Supabase bindings after match and attendance migrations in `src/shared/types/database.generated.ts`
- [ ] T082 [P] [US3] Implement centralized match and attendance query keys plus typed reads/commands in `src/features/matches/api/matches.service.ts` and `src/features/attendance/api/attendance.service.ts`
- [ ] T083 [P] [US3] Implement match list, history, status, and detail screens in `src/features/matches/pages/MatchesPage.tsx` and `src/features/matches/pages/MatchDetailPage.tsx`
- [ ] T084 [US3] Implement staff match create/edit/cancel/reactivate and call-up forms with São Paulo time validation in `src/features/matches/components/MatchForm.tsx` and `src/features/attendance/components/CallUpManager.tsx`
- [ ] T085 [P] [US3] Implement athlete confirmation panel with authoritative deadline states and the foundational online-action guard in `src/features/attendance/components/PresenceResponsePanel.tsx`
- [ ] T086 [P] [US3] Implement UI-only Zustand state for the refusal modal in `src/features/attendance/stores/refusal-modal.store.ts`
- [ ] T087 [US3] Implement the required refusal-reason modal with React Hook Form and Zod, keeping server data out of Zustand in `src/features/attendance/components/RefusalReasonModal.tsx`
- [ ] T088 [P] [US3] Implement the staff attendance dashboard with protected-reason access, guarded writes, and administrative overrides in `src/features/attendance/pages/AttendanceDashboardPage.tsx`
- [ ] T089 [US3] Implement scoped Supabase Realtime subscriptions that only invalidate TanStack queries and unsubscribe on disposal/logout in `src/features/attendance/hooks/use-attendance-realtime.ts`
- [ ] T090 [US3] Register match, athlete attendance, and staff attendance routes with role/AAL2 guards in `src/app/router/router.tsx`

**Checkpoint**: Setup + Foundation + US1–US3 form the usable operational core that replaces the attendance spreadsheet.

---

## Phase 6: User Story 4 - Publicação da escalação oficial (Priority: P2)

**Goal**: Let President/Coach create visual lineup drafts and publish immutable official revisions containing only eligible athletes.

**Independent Test**: Build a draft, reject every ineligible status, publish it, edit as a new revision, republish, and verify authenticated athletes see only the current official version.

### Tests for User Story 4

- [ ] T091 [P] [US4] Add pgTAP tests for allowed formations, lineup revisions, one current publication, assignments, coordinates, reserve ordering, and immutable published records in `supabase/tests/constraints/005_lineups.test.sql`
- [ ] T092 [P] [US4] Add RLS and RPC tests for draft visibility, staff publication, athlete eligibility, supersession, AAL2, and event deduplication in `supabase/tests/rpc/002_publish_lineup.test.sql`
- [ ] T093 [P] [US4] Add unit/component tests for formation validation, accessible tactical representation, eligibility messages, and current-version rendering in `src/features/lineups/lineups.test.tsx`
- [ ] T094 [P] [US4] Add the create/reject/publish/republish/view browser journey in `tests/e2e/lineup-publication.spec.ts`

### Implementation for User Story 4

- [ ] T095 [US4] Create seeded `allowed_formations`, `lineups`, and `lineup_players` with version, assignment, position, immutable-publication, and RLS constraints in `supabase/migrations/20260825001300_lineups.sql`
- [ ] T096 [US4] Implement `publish_lineup` with row locks, eligibility validation, atomic supersession, audit, idempotency, and outbox event in `supabase/migrations/20260825001400_publish_lineup.sql`
- [ ] T097 [US4] Create the minimum-field invoker-safe `published_lineup_view` in `supabase/migrations/20260825001500_published_lineup_view.sql`
- [ ] T098 [US4] Regenerate and verify Supabase bindings after lineup migrations in `src/shared/types/database.generated.ts`
- [ ] T099 [P] [US4] Implement typed draft/current-lineup queries and save/publish commands in `src/features/lineups/api/lineups.service.ts` and `src/features/lineups/queries/lineups.queries.ts`
- [ ] T100 [P] [US4] Implement accessible formation selection and eligibility feedback in `src/features/lineups/components/FormationSelector.tsx`
- [ ] T101 [US4] Implement mobile pointer and keyboard-capable starter positioning plus ordered reserves in `src/features/lineups/components/LineupEditor.tsx`
- [ ] T102 [P] [US4] Implement the read-only official tactical field with a semantic list alternative for assistive technology in `src/features/lineups/components/PublishedLineup.tsx`
- [ ] T103 [US4] Implement online-guarded draft/edit/publish and athlete-view pages in `src/features/lineups/pages/LineupEditorPage.tsx` and `src/features/lineups/pages/PublishedLineupPage.tsx`
- [ ] T104 [US4] Register staff editor and authenticated official-lineup routes in `src/app/router/router.tsx`

**Checkpoint**: User Story 4 is publishable without notifications enabled; the current official lineup remains authoritative in the app.

---

## Phase 7: User Story 5 - Estatísticas e Craque do Jogo (Priority: P2)

**Goal**: Consolidate official results atomically, preserve reversible revisions, expose season rankings, run an exact 24-hour vote, and award all top ties.

**Independent Test**: Consolidate twice with one idempotency key, exercise invalid and valid votes, close a tied round, reopen, correct, reconsolidate, and verify rankings use only the new valid revision.

### Tests for User Story 5

- [ ] T105 [P] [US5] Add pgTAP constraints for immutable consolidation-lineup linkage, score/goal consistency, voting windows, unique/no-self votes, and tied awards in `supabase/tests/constraints/006_statistics_voting.test.sql`
- [ ] T106 [P] [US5] Add RLS tests for President-only consolidation/reopen, Athlete-role voting, hidden vote details, candidate membership, and closed windows in `supabase/tests/rls/005_statistics_voting_rls.test.sql`
- [ ] T107 [P] [US5] Add RPC tests for required published lineup, immutable candidate snapshot after republication, idempotent consolidation, historical invalidation, concurrent voting, and tied close in `supabase/tests/rpc/003_statistics_voting_commands.test.sql`
- [ ] T108 [P] [US5] Add unit/component tests for contribution validation, candidate exclusion, countdown states, rankings, and correction confirmation in `src/features/statistics/statistics-voting.test.tsx`
- [ ] T109 [P] [US5] Add the consolidate/vote/tie/reopen/reconsolidate/history browser journey in `tests/e2e/statistics-mvp.spec.ts`

### Implementation for User Story 5

- [ ] T110 [US5] Create immutable `match_consolidations` linked to exact `lineup_id`, `match_goals`, `mvp_voting_rounds`, `mvp_votes`, and `mvp_awards` with RLS and historical foreign keys in `supabase/migrations/20260825001600_statistics_voting.sql`
- [ ] T111 [US5] Implement `consolidate_match` with required current lineup snapshot, match locking, goal validation, idempotency, exact voting window, audit, and outbox event in `supabase/migrations/20260825001700_consolidate_match.sql`
- [ ] T112 [US5] Implement President-only `reopen_match_statistics` with explanation, invalidation of consolidation/round/awards, preserved history, and audit in `supabase/migrations/20260825001800_reopen_statistics.sql`
- [ ] T113 [US5] Implement `cast_mvp_vote` with server-derived voter, current round, lineup candidates, no-self, unique vote, and deadline checks in `supabase/migrations/20260825001900_cast_mvp_vote.sql`
- [ ] T114 [US5] Implement idempotent `close_mvp_voting` and scheduled recovery invocation that awards every positive top tie in `supabase/migrations/20260825002000_close_mvp_voting.sql`
- [ ] T115 [US5] Create invoker-safe `season_rankings_view` and `open_mvp_voting_view` that exclude invalidated revisions and the caller in `supabase/migrations/20260825002100_statistics_views.sql`
- [ ] T116 [US5] Regenerate and verify Supabase bindings after statistics and voting migrations in `src/shared/types/database.generated.ts`
- [ ] T117 [P] [US5] Implement typed consolidation, reopen, rankings, round, and voting service calls/query keys in `src/features/statistics/api/statistics.service.ts` and `src/features/mvp-voting/api/voting.service.ts`
- [ ] T118 [US5] Implement online-guarded President result/contribution form with score consistency validation and explicit consolidation confirmation in `src/features/statistics/components/ConsolidationForm.tsx`
- [ ] T119 [P] [US5] Implement season rankings and preserved athlete/match history views in `src/features/statistics/pages/SeasonRankingsPage.tsx`
- [ ] T120 [P] [US5] Implement online-guarded current-round candidate list, countdown, one-vote state, and results UI in `src/features/mvp-voting/pages/MvpVotingPage.tsx`
- [ ] T121 [US5] Implement President reopen/correction/reconsolidation UI with mandatory explanation in `src/features/statistics/components/ReopenMatchDialog.tsx`
- [ ] T122 [US5] Register statistics administration, rankings, and Athlete voting routes in `src/app/router/router.tsx`

**Checkpoint**: User Story 5 produces trustworthy rankings and reversible official history under repeated and concurrent requests.

---

## Phase 8: User Story 6 - Avisos e notificações operacionais (Priority: P2)

**Goal**: Publish a chronological notice wall and attempt deduplicated operational push/reminders without making external delivery a dependency of core workflows.

**Independent Test**: Deny push permission, publish each event type under forced provider failure, verify in-app pendencies and business commits, then recover the worker without duplicate deliveries.

### Tests for User Story 6

- [ ] T123 [P] [US6] Add pgTAP tests for notices, subscriptions, recipient delivery uniqueness, reminder keys, retry lifecycle, and aggregate operational metrics in `supabase/tests/constraints/007_notifications.test.sql`
- [ ] T124 [P] [US6] Add RLS tests for notice authorship, subscription ownership, protected provider identifiers, internal-only dispatch, and sanitized payloads in `supabase/tests/rls/006_notifications_rls.test.sql`
- [ ] T125 [P] [US6] Add Edge Function tests for push-identity derivation/rate limits and dispatch claiming, bounded retry, permanent skip, failure isolation, and safe errors in `supabase/functions/tests/notifications-functions.test.ts`
- [ ] T126 [P] [US6] Add component tests for the notice wall, in-app pending banner, permission soft prompt, iOS install guidance, and denied-push fallback in `src/features/notifications/notifications.test.tsx`
- [ ] T127 [P] [US6] Add the notice, reminder, permission-denial, provider-outage, retry, and non-duplication browser journey in `tests/e2e/notices-notifications.spec.ts`

### Implementation for User Story 6

- [ ] T128 [US6] Create length-bounded `notices` and protected `push_subscriptions`, complete delivery policies, and add safe operational aggregate views in `supabase/migrations/20260825002200_notices_notifications.sql`
- [ ] T129 [US6] Implement notice publication with Coach/President AAL2, audit, and transactional outbox recipient creation in `supabase/migrations/20260825002300_publish_notice.sql`
- [ ] T130 [US6] Implement 5-minute Cron scans with exact 24-hour/6-hour targets, 10-minute eligibility windows, missed-window skipping, and deterministic keys in `supabase/migrations/20260825002400_notification_reminders.sql`
- [ ] T131 [US6] Regenerate and verify Supabase bindings after notice and notification migrations in `src/shared/types/database.generated.ts`
- [ ] T132 [P] [US6] Define the push provider interface and forced-failure development adapter in `src/shared/adapters/push/push-adapter.ts`
- [ ] T133 [US6] Implement the authenticated short-lived OneSignal identity-token endpoint with session-derived UUID and thirty-per-hour limit in `supabase/functions/push-identity/index.ts`
- [ ] T134 [US6] Implement the OneSignal server adapter, verified external identity, delivery claiming, bounded retries, disable-on-permanent-error, and safe metrics in `supabase/functions/dispatch-notifications/index.ts`
- [ ] T135 [P] [US6] Place the stable scoped OneSignal worker asset at `public/push/onesignal/OneSignalSDKWorker.js`
- [ ] T136 [US6] Implement canonical-production-only OneSignal initialization, authenticated `push-identity` token retrieval, and login/logout binding in `src/shared/adapters/push/onesignal-browser.ts`
- [ ] T137 [P] [US6] Implement typed notice and in-app pending queries plus publish mutation in `src/features/notices/api/notices.service.ts` and `src/features/notifications/api/notifications.service.ts`
- [ ] T138 [P] [US6] Implement the chronological notice wall and online-guarded authorized publication form in `src/features/notices/pages/NoticesPage.tsx`
- [ ] T139 [P] [US6] Implement the authoritative in-app pending-presence/voting banner independent of push permission in `src/features/notifications/components/PendingActionsBanner.tsx`
- [ ] T140 [US6] Implement contextual permission prompting, denial preference, supported-iOS Home Screen guidance, and manual retry UI in `src/features/notifications/components/PushPermissionCard.tsx`
- [ ] T141 [US6] Register notice and notification-preference routes and add the pending banner to `src/app/layouts/AuthenticatedLayout.tsx`

**Checkpoint**: Every business transaction succeeds during a simulated OneSignal outage, while pending work remains discoverable inside the app.

---

## Phase 9: User Story 7 - Consulta essencial sem conexão (Priority: P3)

**Goal**: Persist only sanitized next-match and published-lineup snapshots per user for 24 hours, show offline state, and prevent every write from being queued or replayed.

**Independent Test**: Prime both allowed queries as user A, reload offline within two seconds, inspect storage/cache/mutations, attempt all write classes, logout or switch to user B, and verify no data crosses identities.

### Tests for User Story 7

- [ ] T142 [P] [US7] Add unit tests for the exact query allowlist, DTO parsing, version/club/user buster, 24-hour expiry, and mutation exclusion in `src/shared/lib/offline-cache.test.ts`
- [ ] T143 [P] [US7] Add component tests for offline/last-updated/no-cached-content states and proactive write-control disabling in `src/features/offline/offline-ui.test.tsx`
- [ ] T144 [P] [US7] Add Playwright coverage for under-two-second restore, localStorage field inspection, no Cache Storage API data, no mutation replay, logout purge, and user switch in `tests/e2e/offline-privacy.spec.ts`

### Implementation for User Story 7

- [ ] T145 [P] [US7] Define Zod-validated minimal `OfflineNextMatch` and `OfflinePublishedLineup` DTOs in `src/shared/types/offline-cache.ts`
- [ ] T146 [US7] Implement the synchronous TanStack persister with exact metadata allowlist, per-user versioned key, 24-hour max age, deployment buster, and no mutation dehydration in `src/shared/lib/offline-cache.ts`
- [ ] T147 [US7] Replace the base query provider with an authenticated per-user `PersistQueryClientProvider` lifecycle in `src/app/providers/QueryProvider.tsx`
- [ ] T148 [US7] Implement multi-tab logout/session-revocation/user-switch purge ordering for memory, disk, active queries, routes, and registered provider cleanup hooks in `src/app/providers/AuthProvider.tsx`
- [ ] T149 [P] [US7] Implement a discreet “Modo Offline”, last-updated timestamp, and no-cache explanation in `src/features/offline/components/OfflineIndicator.tsx`
- [ ] T150 [US7] Mark only next-match and current-published-lineup queries as persistable and map them to sanitized DTOs in `src/features/matches/queries/matches.queries.ts` and `src/features/lineups/queries/lineups.queries.ts`
- [ ] T151 [US7] Configure Workbox to precache only app-shell/static assets, use prompt updates, and exclude all Supabase/Auth responses from runtime caching in `vite.config.ts`

**Checkpoint**: Offline reads meet SC-006, persisted content matches the contract byte-for-byte, and no offline action can later mutate server state.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Complete accessibility, privacy-conscious observability, deployment, backup/recovery, security review, and release validation across all selected stories.

- [ ] T152 [P] Implement the Sentry adapter with PII disabled, no Replay, low sampling, release tags, and `beforeSend` scrubbing in `src/shared/adapters/monitoring/sentry.ts`
- [ ] T153 [P] Add safe request-local Sentry capture and flush helpers for Edge Functions in `supabase/functions/_shared/monitoring.ts`
- [ ] T154 Integrate stable trace IDs and sanitized monitoring into global React and route error boundaries in `src/app/providers/ErrorBoundary.tsx`
- [ ] T155 Configure production-only Sentry source-map upload by commit release and fail if `.map` files remain in the public artifact in `.github/workflows/ci.yml` and `vite.config.ts`
- [ ] T156 [P] Add accessibility regression tests for keyboard, focus, semantics, contrast, screen readers, and touch targets in `tests/e2e/accessibility.spec.ts`
- [ ] T157 [P] Add performance checks for two-second primary/offline screens and list query-count regressions in `tests/e2e/performance.spec.ts`
- [ ] T158 Configure PWA manifest, update prompt, canonical URL metadata, and Portuguese install identity in `vite.config.ts` and `index.html`
- [ ] T159 [P] Define Cloudflare security headers and document SPA fallback/canonical-domain redirect requirements in `public/_headers` and `docs/deployment.md`
- [ ] T160 Document production, staging, preview, custom-domain, Supabase secret, OneSignal worker, and Pages validation steps in `docs/deployment.md`
- [ ] T161 Implement an allowlisted backup script for database roles/schema/data, private Storage objects, manifest, SHA-256, local `age` encryption, private R2 upload/verification, and exit codes in `scripts/backup/export-supabase.ps1`
- [ ] T162 Document the authenticated weekly/pre-migration n8n workflow, private `mbj-backups` R2 credentials, four verified-set retention, UptimeRobot heartbeat, failure alert, and local contingency in `ops/n8n/README.md`
- [ ] T163 Add a production migration workflow that blocks on verified pre-migration backup, performs dry-run/apply, and runs smoke validation in `.github/workflows/database-release.yml`
- [ ] T164 [P] Document isolated monthly restore verification, Auth continuity limits, row counts, and avatar checksum evidence in `docs/backup-restore.md`
- [ ] T165 Configure a five-minute UptimeRobot HTTP/keyword monitor for the canonical production URL and record the tested owner alert in `docs/operations.md`
- [ ] T166 Configure the weekly n8n backup heartbeat monitor and record success/failure tests in `docs/operations.md`
- [ ] T167 [P] Add repository contribution, branch, PR self-review, Definition of Done, and secret/data prohibitions in `CONTRIBUTING.md`
- [ ] T168 Run and record the full role/RLS/privacy/security review checklist against every exposed table, view, RPC, function, log, cache, and deployment secret in `specs/001-mbj-mvp-core/checklists/security-review.md`
- [ ] T169 Execute every command and acceptance scenario from the validation guide and record results or linked defects in `specs/001-mbj-mvp-core/checklists/quickstart-validation.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; begin here.
- **Foundational (Phase 2)**: Depends on Phase 1 and blocks every story.
- **US1 (Phase 3)**: Depends only on Foundation and establishes identity/authorization.
- **US2 (Phase 4)**: Depends on US1 because roster management, roles, and private assets require authenticated President actions.
- **US3 (Phase 5)**: Depends on US1 and US2 because matches reference authorized staff and athletes.
- **US4 (Phase 6)**: Depends on US2 and US3 because lineup eligibility uses athletes, matches, and attendance.
- **US5 (Phase 7)**: Depends on US3 and US4 because consolidation/voting reference the match and published lineup.
- **US6 (Phase 8)**: Notice publication can start after US1; event integrations finish after US3–US5 expose all producers.
- **US7 (Phase 9)**: Depends on US3 and US4 for the two allowlisted read contracts; write guarding integrates with US5/US6 when selected.
- **Polish (Phase 10)**: Applies after all stories selected for a release; backup/deployment foundations may be prepared earlier.

### User Story Dependency Graph

```text
Setup -> Foundation -> US1 -> US2 -> US3 -> US4 -> US5
                       |             |      |
                       +-----------> US6 <-+
                                     |
                             US3 + US4 -> US7
All selected stories ---------------------> Polish/Release
```

### Within Each User Story

1. Create automated tests first and confirm they fail for the intended missing behavior.
2. Add schema/entities and RLS before server commands that depend on them.
3. Add transactional RPC/Edge Function contracts before client service integration.
4. Add queries/forms/components before route integration.
5. Run the independent test and all earlier-story regressions before the checkpoint.

## Parallel Opportunities

- In Setup, T003–T006 and T009–T014 can run concurrently where their listed files do not overlap.
- In Foundation, database tests T019–T020, shared utilities T023–T024, and shared UI T029 can proceed in parallel after their direct prerequisites exist.
- For each story, pgTAP/RLS, component, and Playwright test files marked `[P]` can be authored concurrently before implementation.
- US6 notice UI/schema work may proceed alongside US4/US5, with event-producer integration completed after those commands exist.
- US7 DTO/persistence/UI test work may proceed alongside US5/US6 once US3 and US4 read contracts are stable.
- Sentry, accessibility, performance, deployment docs, and restore docs marked `[P]` can proceed in parallel during Polish.

## Parallel Examples by User Story

### User Story 1

```text
T037 invite constraints | T038 authorization RLS | T039 Edge contracts | T040 UI tests | T041 E2E
T049 login/welcome | T050 invitation UI | T051 password UI | T052 MFA UI
```

### User Story 2

```text
T055 roster constraints | T056 roster RLS | T057 component tests | T058 E2E
T062 avatar optimizer | T063 avatar fallback
```

### User Story 3

```text
T069 constraints | T070 RLS | T071 RPC | T072 components | T073 E2E
T083 match pages | T085 response panel | T086 refusal-modal store | T088 staff dashboard
```

### User Story 4

```text
T091 constraints | T092 RPC/RLS | T093 component tests | T094 E2E
T099 query/services | T100 formation selector | T102 published lineup
```

### User Story 5

```text
T105 constraints | T106 RLS | T107 RPC | T108 components | T109 E2E
T117 query/services | T119 rankings UI | T120 voting UI
```

### User Story 6

```text
T123 constraints | T124 RLS | T125 function tests | T126 components | T127 E2E
T132 push interface | T135 worker asset | T137 query/services | T138 notices UI | T139 pending banner
```

### User Story 7

```text
T142 cache units | T143 offline UI | T144 offline E2E
T145 DTOs | T149 offline indicator
```

## Implementation Strategy

### First Deliverable: Identity Slice

1. Complete Setup and Foundational phases.
2. Complete US1.
3. Stop and validate invitation, login, multi-role, AAL2, password reset, and denial matrix independently.
4. Deploy a staging preview with fictitious identities only.

### Operational MVP: Attendance Core

1. Add US2 and validate roster/history independently.
2. Add US3 and validate the complete match/call-up/attendance journey.
3. Treat Setup + Foundation + US1 + US2 + US3 as the smallest usable club release because it replaces the primary attendance spreadsheet workflow.

### Incremental Delivery

1. Add US4 for official lineup operations.
2. Add US5 for statistics and engagement.
3. Add US6 for notices and resilient push delivery.
4. Add US7 for the approved read-only offline experience.
5. Run Phase 10 for every production candidate and never bypass backup, RLS, privacy, CI, or accessibility gates.

## Notes

- `[P]` means different files and no unfinished direct dependency; it does not authorize simultaneous edits to a shared migration or route file.
- TanStack Query owns all server state; Zustand appears only for ephemeral UI state such as the refusal modal.
- Tests precede implementation because the specification and Constitution explicitly require automated coverage of critical journeys.
- Database business invariants and authorization must pass direct-request tests even when the UI already prevents an action.
- Use fictitious data outside production, never commit `.env.local`, dumps, tokens, real player data, or service-role credentials.
- Commit after each task or coherent task group and run the relevant gate before moving past a checkpoint.
