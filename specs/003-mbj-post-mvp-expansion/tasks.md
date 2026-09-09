---

description: "Task list for Post-MVP Modules Expansion (MBJ)"
---

# Tasks: Post-MVP Modules Expansion (MBJ)

**Input**: Design documents from `/specs/003-mbj-post-mvp-expansion/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: INCLUDED. Constitution Principle IV requires automated tests for critical journeys
(authentication, permissions/RLS, statistics consolidation, etc.), and `quickstart.md` defines the
end-to-end validation scenarios. pgTAP (`supabase test db`), Vitest unit tests, and Playwright e2e
tasks are therefore part of every user story.

**Organization**: Tasks grouped by user story (US1 Finance = P1 … US4 Gamification = P4), each an
independently testable increment.

## Path Conventions

- Frontend: `src/features/<feature>/{api,queries,components,pages,lib}`, `src/app/...`, `src/shared/...`
- Database: `supabase/migrations/*.sql` (versioned), `supabase/tests/*.test.sql` (pgTAP),
  `supabase/functions/*` (Edge Functions)
- App tests: `tests/unit/*.test.ts`, `tests/e2e/*.spec.ts`
- Migration timestamps below are placeholders in the `20260908HHMMSS_` family; keep them strictly
  increasing and after the last MVP migration (`20260901000100_*`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Skeletons and wiring so every later task has a home.

- [X] T001 [P] Create feature folder skeletons `src/features/{finance,social-events,gamification,live-match}/{api,queries,components,pages,lib}` with an `index.ts` barrel each
- [X] T002 [P] Register lazy routes `/app/financeiro`, `/app/resenhas`, `/app/historico`, `/app/partidas/:matchId/sumula` in `src/app/router/` pointing at placeholder pages
- [X] T003 [P] Add "Histórico & Conquistas" navigation entry (sidebar + mobile drawer) in `src/app/layouts/navigation/`
- [X] T004 Verify pgTAP wiring in `supabase/config.toml` and add `supabase/tests/003_*` files to the test run; add a `supabase/tests/003_smoke.test.sql` that asserts the MVP schema is present
- [X] T005 [P] Add `src/shared/lib/datetime.ts` helper for `America/Sao_Paulo` display formatting (reused by finance, events, súmula)

**Checkpoint**: Routes resolve to placeholders; test runner picks up `003_*` files.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Season lifecycle + consolidation refactor + trophy hook. **Blocks all user stories.**

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

- [X] T006 Migration `supabase/migrations/20260908120100_seasons_lifecycle.sql`: extend `public.seasons` with `starts_on date not null`, `ends_on date`, `status public.season_status` (new enum `ACTIVE`/`CLOSED`); backfill existing rows; add constraints (`ends_on` null iff `ACTIVE`, `ends_on >= starts_on`); trigger `sync_season_is_active` keeping `is_active = (status='ACTIVE')`; keep index `seasons_one_active_key`
- [X] T007 Migration `supabase/migrations/20260908120200_seasons_commands.sql`: RPCs `open_season(year, starts_on, idempotency_key)` and `close_season(season_id, ends_on, idempotency_key)` — `security definer`, require `COACH` or `PRESIDENT` + AAL2, reject a second `ACTIVE`, `append_audit_log`, cache in `private.command_results`
- [X] T008 [P] pgTAP `supabase/tests/003_seasons.test.sql`: exactly one `ACTIVE`; `CLOSED→ACTIVE→CLOSED` transitions; `is_active` sync; RBAC/AAL2 rejection; prior-season rows untouched on open
- [ ] T009 Migration `supabase/migrations/20260908120300_write_consolidation_refactor.sql`: extract the consolidation body of `public.consolidate_match` into internal `private.write_consolidation(match_record, lineup_record, mbj_score, opponent_score, goals_input, idempotency_key, actor_user_id)`; `consolidate_match` becomes a thin caller that still runs `private.require_president_aal2()` — **no behavior change**
- [ ] T010 [P] pgTAP `supabase/tests/003_write_consolidation.test.sql`: regression — existing `consolidate_match` scenarios (revision increment, goal count = score, voting round opened, match `COMPLETED`, audit) still pass after the refactor
- [X] T011 [P] Migration `supabase/migrations/20260908120400_evaluate_trophies_stub.sql`: create no-op `private.evaluate_trophies(season_id uuid, athlete_ids uuid[])` returning void (replaced in US4 so US3 stays independently testable)
- [X] T012 Run `npm run db:types` and commit regenerated types under `src/shared/types/`

**Checkpoint**: Season can be opened/closed; consolidation refactor is green; trophy hook exists.

---

## Phase 3: User Story 1 — Financial dues and manual settlement (Priority: P1) 🎯 MVP

**Goal**: Automatic monthly dues + manual charges/adjust/exempt + discreet delinquency badge (never
blocking) + manual settle / reverse / cancel, all audited.

**Independent Test**: Configure the default amount, run generation for 20 active athletes → 20
`PENDING` charges due on the 10th; re-run → no duplicates; exempt one → skipped next month; badge
shows on the athlete profile but match/lineup/vote access is unaffected; settle → badge clears;
reverse → back to `OVERDUE`; cancel another → leaves badges and totals. (quickstart Cenário 1)

### Tests for User Story 1

- [X] T013 [P] [US1] pgTAP `supabase/tests/003_finance_charges.test.sql`: charge state machine (`PENDING⇄OVERDUE`, `→PAID`, `PAID→PENDING/OVERDUE`, `→CANCELLED`), forbidden transitions raise `CHARGE_LOCKED`, every transition writes an audit row with actor/reason
- [X] T014 [P] [US1] pgTAP `supabase/tests/003_finance_generation.test.sql`: monthly generation creates one `MONTHLY_AUTOMATIC` charge per non-`INACTIVE` athlete, `due_date` = day 10, idempotent on re-run (`unique (athlete_id, period)`), skips period + indefinite exemptions, `NO_ACTIVE_SEASON` guard
- [X] T015 [P] [US1] pgTAP `supabase/tests/003_finance_rls.test.sql`: `ATHLETE` reads only own charges; `PRESIDENT` reads all; non-president write attempts are `FORBIDDEN`; no matches/lineups/voting policy references `athlete_charges` (SC-006)
- [X] T016 [P] [US1] Unit `tests/unit/finance-format.test.ts`: `pt-BR` currency + `YYYY-MM` period + due-date formatting for `src/features/finance/lib/currency.ts`
- [X] T017 [P] [US1] E2E `tests/e2e/finance.spec.ts`: quickstart Cenário 1 end to end (generate, idempotent re-run, exempt, badge non-blocking, settle, reverse, cancel)

### Implementation for User Story 1

- [X] T018 [P] [US1] Migration `supabase/migrations/20260908130100_finance_enums.sql`: enums `charge_status` (`PENDING`,`PAID`,`OVERDUE`,`CANCELLED`), `charge_type` (`MONTHLY_AUTOMATIC`,`MANUAL_OVERRIDE`,`EVENT_FEE`)
- [X] T019 [US1] Migration `supabase/migrations/20260908130200_finance_schema.sql`: tables `dues_settings` (singleton), `dues_exemptions`, `athlete_charges` with all constraints, `unique (athlete_id, period) where type='MONTHLY_AUTOMATIC'`, indexes from `data-model.md`, RLS policies, and a trigger blocking non-RPC `update`/`delete`
- [X] T020 [US1] Migration `supabase/migrations/20260908130300_finance_commands_admin.sql`: RPCs `set_default_dues_amount`, `create_manual_charge`, `adjust_charge_amount` (PRESIDENT + AAL2, audit, `command_results`) per `contracts/finance.md`
- [X] T021 [US1] Migration `supabase/migrations/20260908130400_finance_commands_settlement.sql`: RPCs `settle_charge`, `reverse_charge_settlement`, `cancel_charge` with the state-machine guards and audit reasons
- [X] T022 [US1] Migration `supabase/migrations/20260908130500_finance_exemptions.sql`: RPCs `grant_dues_exemption` (period or `null` = indefinite), `revoke_dues_exemption`
- [X] T023 [US1] Migration `supabase/migrations/20260908130600_finance_cron.sql`: `run_monthly_dues_generation(period, idempotency_key)` RPC + `private.generate_monthly_dues()` + `private.mark_overdue_charges()` + `cron.schedule` entries (monthly day 1 06:00 SP; daily 03:00) — returns `{ created, skippedExempt, skippedExisting, activeAthletes }`
- [X] T024 [P] [US1] Migration `supabase/migrations/20260908130700_finance_views.sql`: `public.athlete_delinquency_badge(athlete_id)` and `public.finance_overview` (per-athlete pending/overdue/paidThisSeason/badge), RLS-safe
- [X] T025 [US1] Run `npm run db:types`
- [X] T026 [P] [US1] `src/features/finance/lib/currency.ts`: `pt-BR` money format, period helpers, due-date computation
- [X] T027 [P] [US1] `src/features/finance/api/charges.ts`: service-layer wrappers over the RPCs and reads, normalized `{ data, error }`
- [X] T028 [P] [US1] `src/features/finance/queries/`: TanStack Query hooks `useFinanceOverview`, `useAthleteCharges`, `useDelinquencyBadge`, plus mutation hooks with idempotency-key generation
- [X] T029 [P] [US1] `src/features/finance/components/DelinquencyBadge.tsx`: discreet "Pendente"/"Em Atraso" chip, Dark Navy tokens, WCAG AA contrast/labels
- [X] T030 [US1] `src/features/finance/components/`: `ChargeList.tsx`, `SettleDialog.tsx`, `ManualChargeForm.tsx`, `AdjustAmountDialog.tsx`, `ExemptionDialog.tsx` (React Hook Form + Zod)
- [X] T031 [US1] `src/features/finance/pages/FinancePanelPage.tsx`: directorate panel (list + filters + actions + "rodar geração agora"), wired into the `/app/financeiro` route
- [X] T032 [US1] Integrate `DelinquencyBadge` into the athlete profile in `src/features/roster/` (read-only, never gates navigation)
- [X] T033 [US1] `src/features/finance/pages/MyChargesPage.tsx` (or profile section): athlete view of own charges only

**Checkpoint**: US1 fully functional and independently testable — this is the shippable MVP.

---

## Phase 4: User Story 2 — Social event organization and cost split (Priority: P2)

**Goal**: Create Resenha/Churrasco events, athletes confirm with companion counts (0..20), live
per-person split while `OPEN`, frozen exactly (R$ 0,00 error) on close.

**Independent Test**: Event with `total_cost` 600,00; 10 confirm, 5 with +1 → every confirmed screen
shows 40,00; change a companion count → recalculates immediately; zero confirmed → "split
unavailable", no error; close → `Σ shares == 600,00` and further changes return `EVENT_CLOSED`.
(quickstart Cenário 2)

### Tests for User Story 2

- [X] T034 [P] [US2] pgTAP `supabase/tests/003_social_split.test.sql`: `close_social_event` distributes cents deterministically so `Σ shares == total_cost` exactly across several counts (15, 16, 7, prime counts); zero confirmed → `VALIDATION_ERROR`
- [X] T035 [P] [US2] pgTAP `supabase/tests/003_social_rls.test.sql`: `guests_count` `0..20` check; athlete manages only own presence; `set_event_presence` on a `CLOSED` event → `EVENT_CLOSED`; frozen values immutable after close
- [X] T036 [P] [US2] Unit `tests/unit/social-split.test.ts`: display-split mirror in `src/features/social-events/lib/split.ts` matches the SQL rule (incl. `peopleCount = 0`)
- [X] T037 [P] [US2] E2E `tests/e2e/social-events.spec.ts`: quickstart Cenário 2

### Implementation for User Story 2

- [X] T038 [P] [US2] Migration `supabase/migrations/20260908140100_social_enums.sql`: enums `social_event_status` (`OPEN`,`CLOSED`), `event_presence_status` (`CONFIRMED`,`DECLINED`)
- [X] T039 [US2] Migration `supabase/migrations/20260908140200_social_schema.sql`: tables `social_events`, `social_event_presences` (`unique (social_event_id, athlete_id)`, `check (guests_count between 0 and 20)`), indexes, RLS
- [X] T040 [US2] Migration `supabase/migrations/20260908140300_social_commands.sql`: RPCs `create_social_event`, `update_social_event` (OPEN-only), `set_event_presence` (own row, OPEN-only) per `contracts/social-events.md`
- [X] T041 [US2] Migration `supabase/migrations/20260908140400_social_close.sql`: RPC `close_social_event` — transactional, computes `peopleCount`, deterministic cent distribution (base + 1 cent to first `remainder` shares ordered by `athlete_id`), writes `frozen_cost_per_person`/`frozen_people_count`/`closed_by`/`closed_at`, `status='CLOSED'`; **no `EVENT_FEE` charge** (FR-017)
- [X] T042 [P] [US2] Migration `supabase/migrations/20260908140500_social_views.sql`: functions `social_event_split(event_id)` and `social_event_participants(event_id)` (derived while OPEN, frozen when CLOSED)
- [X] T043 [US2] Run `npm run db:types`
- [X] T044 [P] [US2] `src/features/social-events/lib/split.ts`: display mirror of the split rule
- [X] T045 [P] [US2] `src/features/social-events/api/*.ts` + `src/features/social-events/queries/*.ts`
- [X] T046 [US2] `src/features/social-events/components/`: `EventForm.tsx`, `PresenceControl.tsx` (confirm/decline + guests stepper capped at 20), `SplitSummary.tsx`, `CloseEventDialog.tsx`
- [X] T047 [US2] `src/features/social-events/pages/`: `SocialEventsListPage.tsx` + `SocialEventDetailPage.tsx`, wired into `/app/resenhas`

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 — Live match recording with stopwatch and undo (Priority: P3)

**Goal**: Pre-match live-recording setup + per-match Field Recorder + stopwatch quick actions +
30 s undo + real-time broadcast + offline buffer (súmula screen only) + post-match review whose
**finalization is committee/admin-only** and consolidates statistics via the existing chain.

**Independent Test**: Enable live recording, assign a non-committee recorder; log goal at 14', log
again by mistake, "Desfazer" within 30 s → one goal at 14' broadcast in < 2 s; go offline, log two
events → buffered, "Finalizar" disabled; reconnect → drains without duplicates; recorder opens
review, edits, tries to finalize → `FORBIDDEN`; committee finalizes → consolidation matches the
reviewed data exactly, idempotent on retry. (quickstart Cenários 3 & 4)

### Tests for User Story 3

- [ ] T048 [P] [US3] pgTAP `supabase/tests/003_live_undo.test.sql`: `undo_live_event` flips the newest non-undone event within 30 s (soft `undone` flag, not delete); outside the window → `UNDO_WINDOW_EXPIRED`; undone events excluded from reads and consolidation
- [ ] T049 [P] [US3] pgTAP `supabase/tests/003_live_idempotency.test.sql`: repeated `log_live_event` with the same `client_event_id` inserts once (`on conflict do nothing`), returns `deduped=true`; out-of-order undo/log reconcile by `client_event_id`
- [ ] T050 [P] [US3] pgTAP `supabase/tests/003_live_authz.test.sql`: only `setup.recorder_user_id` (while `RECORDING`) or `COACH`/`PRESIDENT` may log/undo; authorization ends on status change or re-assignment (SC-013); `finalize_sumula` by a non-committee recorder → `FORBIDDEN`. **Stale-recorder case**: Recorder A assigned via `enable_live_recording`; `assign_field_recorder` re-points the setup to Recorder B; a subsequent `log_live_event` (and `undo_live_event`) by Recorder A returns `RECORDER_ONLY`; Recorder B's `log_live_event` still succeeds.
- [ ] T051 [P] [US3] pgTAP `supabase/tests/003_finalize_sumula.test.sql`: `finalize_sumula` is atomic + idempotent (`command_results`), derives scores from non-undone events, writes one `match_consolidations` revision + `match_goals` + `match_cards` + `match_substitutions` + `match_goalkeeper_assignments` matching the payload exactly (SC-004), sets `status=FINALIZED`, opens voting, blocks with `PENDING_OFFLINE_EVENTS`
- [ ] T052 [P] [US3] Unit `tests/unit/match-clock.test.ts`: `src/features/live-match/lib/match-clock.ts` start / elapsed-minute / pause-resume for half-time
- [ ] T053 [P] [US3] Unit `tests/unit/offline-queue.test.ts`: `src/features/live-match/lib/offline-queue.ts` IndexedDB store add / dedupe by `client_event_id` / drain in `created_at` order / empty-state
- [ ] T054 [P] [US3] E2E `tests/e2e/live-match-recording.spec.ts`: quickstart Cenário 3 (live, undo, offline buffer + gate, recorder cannot finalize)
- [ ] T055 [P] [US3] E2E `tests/e2e/live-match-finalize.spec.ts`: quickstart Cenário 4 (review edit, committee finalize, 0 % divergence, idempotent retry, goalkeeper-substitution voids clean sheet)

### Implementation for User Story 3

- [ ] T056 [P] [US3] Migration `supabase/migrations/20260908150100_live_enums.sql`: enums `live_sumula_status`, `live_event_type`, `team_side`, `card_type`
- [ ] T057 [US3] Migration `supabase/migrations/20260908150200_live_setups.sql`: table `live_match_setups` (1:1 with match), RLS, status transitions, `starting_goalkeeper_athlete_id`, indexes
- [ ] T058 [US3] Migration `supabase/migrations/20260908150300_live_events.sql`: table `live_match_events` with `unique (client_event_id)`, `undone` soft flag, RLS `select` for active accounts, add to the Realtime publication filtered by `match_id`, indexes
- [ ] T059 [P] [US3] Migration `supabase/migrations/20260908150400_live_stats_tables.sql`: tables `match_cards`, `match_substitutions`, `match_goalkeeper_assignments` bound to `consolidation_id`, immutability triggers (`private.reject_statistics_history_mutation`), indexes
- [ ] T060 [US3] Migration `supabase/migrations/20260908150500_live_setup_commands.sql`: RPCs `enable_live_recording` (pre-match, published lineup required, any active account as recorder), `assign_field_recorder` (revokes prior authorization)
- [ ] T061 [US3] Migration `supabase/migrations/20260908150600_live_event_commands.sql`: RPCs `log_live_event`, `undo_live_event`, `amend_live_event` (review only), `end_live_recording`, `cancel_live_recording` per `contracts/live-match.md`
- [ ] T062 [US3] Migration `supabase/migrations/20260908150700_finalize_sumula.sql`: RPC `finalize_sumula(match_id, reviewed_payload, idempotency_key)` — `COACH`/`PRESIDENT` + AAL2; derive scores from non-undone events; call `private.write_consolidation(...)`; insert `match_cards`/`match_substitutions`/`match_goalkeeper_assignments`; call `private.evaluate_trophies(active_season, affected_athletes)`; `setup.status='FINALIZED'`; audit `SUMULA_FINALIZED`; `command_results`
- [ ] T063 [US3] Run `npm run db:types`
- [ ] T064 [P] [US3] `src/features/live-match/lib/match-clock.ts`
- [ ] T065 [P] [US3] `src/features/live-match/lib/offline-queue.ts` (IndexedDB single store `pending_events`, `online` listener drain, pending count)
- [ ] T066 [P] [US3] `src/features/live-match/api/*.ts` (RPC wrappers incl. `client_event_id` generation)
- [ ] T067 [P] [US3] `src/features/live-match/queries/*.ts` incl. `useLiveSumulaFeed` (Supabase Realtime Postgres Changes subscription, ignores `undone`)
- [ ] T068 [US3] `src/features/live-match/components/`: `Stopwatch.tsx`, `QuickActions.tsx` (GOAL/ASSIST/YELLOW/RED/SUBSTITUTION with current minute + athlete picker), `UndoButton.tsx` (floating, 30 s window)
- [ ] T069 [US3] `src/features/live-match/components/ReviewScreen.tsx`: editable minute / author / assist author; "Confirmar e Finalizar Súmula" disabled while offline queue non-empty or user lacks committee/admin role
- [ ] T070 [US3] `src/features/live-match/components/SpectatorFeed.tsx`: real-time event list for athletes/viewers (< 2 s), undone events hidden
- [ ] T071 [US3] `src/features/live-match/pages/`: `LiveRecordingPage.tsx` + `SumulaReviewPage.tsx`, wired into `/app/partidas/:matchId/sumula`
- [ ] T072 [US3] Add the pre-match "registrar ao vivo" toggle + recorder + starting-goalkeeper picker to the match detail screen in `src/features/matches/`

**Checkpoint**: US1, US2, US3 each independently functional. Trophies are not yet awarded on finalize (stub) — added in US4.

---

## Phase 6: User Story 4 — Attribute cards, trophies, Raio-X, and notifications (Priority: P4)

**Goal**: Premium MBJ collectible player cards (EA FC-inspired, own identity, no third-party marks;
detailed + compact variants; simple-average overall, incomplete state), fixed 5-trophy catalog
awarded automatically per active season, head-to-head "Raio-X" card, "Histórico & Conquistas" tab,
deterministic weekly-highlight push.

**Independent Test**: Set six attributes → **detailed** card renders with the MBJ gold frame +
dark backdrop, info rail (overall, position abbreviation, BR flag, crest), hero photo, nameplate and
the `RIT/FIN/PAS/CON/DEF/FÍS` strip, `overall = round(mean)`; leave one attribute null → incomplete
state on both variants; a multi-athlete listing renders **compact** cards that reflow on
desktop/tablet/mobile; scheduled match vs a faced opponent → Raio-X totals match an independent
count; vs a new opponent → "no history"; consolidate matches meeting a trigger → trophy appears once
per season; open a new season → counters reset, old trophies remain; run weekly highlights twice →
identical output; push outage → other flows unaffected. (quickstart Cenários 5 & 6)

### Tests for User Story 4

- [ ] T073 [P] [US4] pgTAP `supabase/tests/003_card_attributes.test.sql`: `overall` generated column = `round(mean of six)`, `null` when any attribute null; only `COACH`/`PRESIDENT` may write
- [ ] T074 [P] [US4] pgTAP `supabase/tests/003_trophies.test.sql`: `private.evaluate_trophies` awards each catalog trophy once per `(athlete, code, season)`, never duplicates, never revokes; `HAT_TRICK` per single match; season reset via `open_season`; goalkeeper substitution voids `MURALHA` credit
- [ ] T074a [P] [US4] pgTAP `supabase/tests/003_trophies_retroactive.test.sql`: retroactive-award path — a match is finalized; `reopen_statistics` invalidates the consolidation; a corrected re-finalization (new revision) pushes an athlete over a trigger threshold; **then** `private.evaluate_trophies` awards the newly-qualified trophy, creates **no** duplicate of any trophy the athlete already holds for that season, and leaves every previously awarded trophy intact (spec Edge Case "Trophy trigger met retroactively after a súmula edit"; contracts/live-match.md "Correção pós-finalização")
- [ ] T075 [P] [US4] pgTAP `supabase/tests/003_raio_x.test.sql`: `head_to_head_record` wins/draws/losses/goalDiff match an independent count over `COMPLETED` + `VALID` matches; `hasHistory=false` when none
- [ ] T076 [P] [US4] pgTAP `supabase/tests/003_weekly_highlights.test.sql`: `generate_weekly_highlights` is deterministic over identical data, omits a tied/empty category, enqueues exactly one `notification_outbox` row
- [ ] T077 [P] [US4] E2E `tests/e2e/gamification.spec.ts`: quickstart Cenário 5 — **detailed** card renders the gold frame + backdrop + info rail (overall, position, BR flag, MBJ crest) + hero photo + nameplate + `RIT/FIN/PAS/CON/DEF/FÍS` strip; incomplete state (any attribute null → "—" per stat, no overall); **compact** card in a roster grid preserves photo/overall/name/position and reflows on desktop/tablet/mobile; asset check — no EA/FIFA logo/trademark string or reference-JPEG URL present in the DOM/bundle; Raio-X both cases; history tab + gallery
- [ ] T078 [P] [US4] E2E `tests/e2e/highlights.spec.ts`: quickstart Cenário 6 (weekly highlight determinism + push-outage resilience)
- [ ] T078a [P] [US4] pgTAP `supabase/tests/003_pre_match_highlights.test.sql`: `private.generate_pre_match_highlights(match_id)` — builds a deterministic payload containing MBJ's key active-season stats **and** the head-to-head (Raio-X) record vs the scheduled opponent (`hasHistory=false` → "primeiro confronto"); carries **no** opponent season stats; `route='/app/partidas/:matchId'`; enqueues exactly one `PRE_MATCH_HIGHLIGHTS` row in `notification_outbox`; is **idempotent** per `match_id` (re-run does not enqueue a second row); a push-provider failure does not block the match-reminder routine or any other flow (FR-025/FR-026, SC-007)

### Implementation for User Story 4

- [ ] T079 [P] [US4] Migration `supabase/migrations/20260908160100_card_attributes.sql`: table `athlete_card_attributes` (six `smallint` 1..99 nullable, `overall` generated stored), RLS (active accounts read)
- [ ] T080 [P] [US4] Migration `supabase/migrations/20260908160200_trophy_catalog.sql`: enum `trophy_scope`; table `trophy_catalog` + seed the 5 trophies (`ARTILHEIRO`,`GARCOM`,`HAT_TRICK`,`VETERANO`,`MURALHA`) with thresholds and pt-BR text; no write RPC
- [ ] T081 [US4] Migration `supabase/migrations/20260908160300_athlete_trophies.sql`: table `athlete_trophies` with `unique (athlete_id, trophy_code, season_id)`, immutability trigger, RLS
- [ ] T082 [US4] Migration `supabase/migrations/20260908160400_evaluate_trophies.sql`: `create or replace function private.evaluate_trophies(season_id uuid, athlete_ids uuid[])` with the real season-scoped rules from `contracts/gamification.md` (`on conflict do nothing`); replaces the Phase 2 stub
- [ ] T083 [US4] Migration `supabase/migrations/20260908160500_card_attributes_command.sql`: RPC `set_athlete_attributes` (`COACH`/`PRESIDENT` + AAL2, audit)
- [ ] T084 [P] [US4] Migration `supabase/migrations/20260908160600_gamification_views.sql`: views `head_to_head_record`, `club_all_time_record`, `season_scoring_leaders`, `season_trophy_progress`, `athlete_card` (six attributes, `overall`, `incomplete`, **`primary_position`** from `athletes`, `shirt_name`, `shirt_number`, `photo_path`), `athlete_trophy_gallery`
- [ ] T085 [US4] Migration `supabase/migrations/20260908160700_highlights_cron.sql`: `private.generate_weekly_highlights()` (`cron.schedule` weekly Monday 08:00 SP; `route='/app/historico'`) + `private.generate_pre_match_highlights(match_id)` — **hooked into the existing MVP match-reminder routine (~24 h before kickoff), no new scheduler**; payload = MBJ's key active-season stats + the head-to-head (Raio-X) record vs the opponent (no opponent season stats); `route='/app/partidas/:matchId'`; idempotent per `match_id`. Both use `private.enqueue_notification(...)` (`WEEKLY_HIGHLIGHTS` / `PRE_MATCH_HIGHLIGHTS`)
- [ ] T086 [US4] Extend `supabase/functions/dispatch-notifications/index.ts` to render the `WEEKLY_HIGHLIGHTS` (route `/app/historico`) and `PRE_MATCH_HIGHLIGHTS` (route `/app/partidas/:matchId`) payloads; graceful no-op on push-provider failure
- [ ] T087 [US4] Run `npm run db:types`
- [ ] T088 [P] [US4] `src/features/gamification/api/*.ts` + `src/features/gamification/queries/*.ts`
- [ ] T088a [P] [US4] Player-card visual assets, hand-authored SVG (all token-/`currentColor`-driven, no colour outside the token system, **not** derived from the reference JPEGs): `src/features/gamification/assets/card-frame.svg` (ornamental MBJ frame ≤ 12 KB), `card-backdrop.svg` (gold glow + rays + particles ≤ 20 KB; optional 1 grain `.webp` ≤ 20 KB), `br-flag.svg` (public-domain, ≤ 3 KB), `card-photo-placeholder.svg` (silhouette ≤ 3 KB). Add a size-budget assertion in `tests/unit/card-assets.test.ts` (each file ≤ its budget). `scripts/generate-brand-assets.mjs` is **not** modified (it generates `public/brand/*` rasters from source art; these are authored SVGs). The MBJ crest watermark reuses `public/brand/mbj-shield.svg` via CSS `opacity`/`filter` — no new file.
- [ ] T088b [P] [US4] Self-hosted display typeface: add one SIL OFL sporty display family (≤ 2 weights, each `.woff2` ≤ ~40 KB) under `public/fonts/`; a local `@font-face` block with `font-display: swap`; the `--font-display` token in `src/index.css` **and** its `@theme inline` mapping (`--font-display: ...`) so Tailwind consumes it; the mirrored value in `src/config/club.config.ts` so `club.config.test.ts` parity passes; and `public/fonts/*.woff2` added to the `vite-plugin-pwa` precache glob (`vite.config.ts`) so the nameplate font works offline. No external font provider, no npm dependency.
- [ ] T089 [US4] `src/features/gamification/components/AttributeCard/`: primitives — `CardFrame.tsx` (inline SVG ornamental frame, portrait ≈ 2:3, stroke via `--accent`/`--secondary`, ornamental top, bottom tab, defines the photo clip region) and `CardBackdrop.tsx` (dark-navy gradient + radial gold glow + subtle starburst rays + particle layer + low-opacity MBJ crest watermark) — all from tokens/gradients/SVG, passing `tests/unit/theme-static-scan.test.ts`
- [ ] T089a [US4] `AttributeCard` **detailed** variant: `AttributeCard.tsx` (orchestrator, `variant` prop), `CardInfoRail.tsx` (large `overall`, position abbreviation, `br-flag.svg`, MBJ crest), `CardPhoto.tsx` (fallback chain: cutout slot → `athletes.photo_path` avatar → `card-photo-placeholder.svg`), `CardNameplate.tsx` (name in `--font-display`, gold rules), `CardAttributes.tsx` (six equal columns `RIT/FIN/PAS/CON/DEF/FÍS` with values + "—" placeholders and no-overall incomplete state), `attributeCard.constants.ts` (sigla↔attribute map + order, **`primary_position` → pt-BR abbreviation map** with 3-letter uppercase fallback, aspect ratio 2:3, container breakpoints). Fluid scaling via CSS container queries. Unit `tests/unit/attribute-card.test.ts`: sigla↔attribute mapping and order; position-abbreviation map + fallback; `overall` passed through verbatim from the query (never recomputed client-side); incomplete state when any attribute is null.
- [ ] T089b [US4] `AttributeCard` **compact** variant (same component, `variant="compact"`): simplified frame/backdrop, preserves photo + `overall` badge + name + position + gold-on-navy identity, omits BR flag and the full attribute strip; **incomplete state** = no `overall` badge (attribute strip already omitted); sized for a responsive CSS grid (`repeat(auto-fill, minmax(...))`) that reflows on desktop/tablet/mobile. Extends the same `AttributeCard/` files as T089a — not parallelizable with it.
- [ ] T090 [P] [US4] `src/features/gamification/components/RaioXCard.tsx`: head-to-head panel with the "sem histórico" state
- [ ] T091 [US4] `src/features/gamification/components/AttributeEditor.tsx`: admin form (React Hook Form + Zod, COACH/PRESIDENT)
- [ ] T092 [US4] `src/features/gamification/pages/HistoryAchievementsPage.tsx`: club all-time record + trophy gallery (all seasons), wired into `/app/historico` and the nav entry
- [ ] T093 [US4] Integrate `RaioXCard` into the scheduled-match detail screen in `src/features/matches/`
- [ ] T094 [US4] Integrate the cards: **detailed** `AttributeCard` + trophy gallery on the athlete profile in `src/features/roster/`; **compact** `AttributeCard` as the tile in any multi-athlete listing/grid in `src/features/roster/` (behind the existing roster query, no new data)
- [ ] T095 [US4] Season admin UI: `open_season` / `close_season` controls in an admin/settings page (COACH/PRESIDENT), surfacing the active season

**Checkpoint**: All four user stories independently functional; finalize now awards trophies.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T096 [P] Run the full `quickstart.md` validation (Cenários 1–6) against a fresh `npm run db:reset`
- [ ] T097 [P] Accessibility audit (`@axe-core/playwright`) of every new screen — WCAG AA contrast, focus, keyboard, 44px targets — in `tests/e2e/`. Player card specifics: the name and every attribute value keep contrast ≥ 4.5:1 against their immediate (darkest underlying) layer; the card exposes a visible focus ring when it is a link/button; the athlete photo has meaningful `alt`; info is not conveyed by colour alone (labels + numbers present); both `detailed` and `compact` variants pass. Register the new routes (`/app/financeiro`, `/app/resenhas`, `/app/historico`, `/app/partidas/:matchId/sumula`) in the feature-002 palette-conformance sweep `tests/e2e/theme-consistency.spec.ts`. In the same spec, add a lightweight pt-BR check: for each new screen, assert a few known user-facing labels render in Brazilian Portuguese (e.g. "Pendente", "Em Atraso", "Fechar Evento & Consolidar Rateio", "Confirmar e Finalizar Súmula", "Histórico & Conquistas", the card siglas "RIT/FIN/PAS/CON/DEF/FÍS") and that no placeholder/English fallback string (e.g. a raw i18n key) is visible (FR-041). No new tooling.
- [ ] T098 [P] Sentry/log review: confirm the new features emit no personal data or secrets; verify offline `localStorage`/IndexedDB carries no unnecessary PII and is purged on logout
- [ ] T099 [P] Write the RLS & privacy review note for the PR (new tables, policies, cron functions, and the single active constitutional deviation — Principle V súmula offline buffer — with its remediation/migration plan; note that the Financial ledger is compliant under Constitution v1.1.0, not a deviation)
- [ ] T100 [P] Green `npm run lint && npm run typecheck && npm run test:unit && npm run test:db && npm run db:types:check && npm run build`
- [ ] T101 Update `docs/operations.md` (three new cron jobs: monthly dues, daily overdue, weekly highlights) and `docs/deployment.md` (migration order + verified backup before the critical migration)
- [ ] T102 [P] Performance check: live event p95 < 2 s (SC-003) via `tests/e2e/`; monthly batch completes within one cron window for the full active roster (SC-001)
- [ ] T103 Confirm a verified Supabase production backup completed **before** applying these migrations (release checklist gate, Constitution Principle II / Workflow §4)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: after Setup. **Blocks all user stories.** T006→T007→T008; T009→T010; T011, T012 independent within the phase after T006.
- **US1 (Phase 3)**: after Phase 2. Independent of US2/US3/US4.
- **US2 (Phase 4)**: after Phase 2. Independent of US1/US3/US4.
- **US3 (Phase 5)**: after Phase 2 (needs `private.write_consolidation` from T009 and the `evaluate_trophies` stub from T011). Independent of US1/US2.
- **US4 (Phase 6)**: after Phase 2 for cards/Raio-X/highlights; the **trophy-on-finalize** path (T082 replacing the stub) requires US3's `finalize_sumula` (T062) to exist. Cards, Raio-X, history tab, and weekly highlights are fully independent of US3. **T074a** (retroactive-trophy pgTAP) additionally needs `finalize_sumula` (T062) + `reopen_statistics` (MVP) + the real `evaluate_trophies` (T082). **T078a** (pre-match-highlight pgTAP) needs the gamification views (T084) + `generate_pre_match_highlights` (T085); both are `[P]` in their own test files.
- **Player-card chain (US4)**: `T088a` (assets) and `T088b` (font/token) are `[P]`, need only Phase 2. `T089` (frame/backdrop primitives) needs T088a + T088b. `T089a` (detailed variant) needs T089 + T088 (queries) + T084 (`athlete_card` view with `primary_position`). `T089b` (compact variant) extends the same `AttributeCard/` files → runs **after** T089a, not parallel. `T094` (profile + grid integration) needs T089a + T089b; `T077` (gamification e2e) needs T089a + T089b + T092 + T093.
- **Polish (Phase 7)**: after all targeted user stories.

### Within Each User Story

- Tests are written first and expected to fail before implementation.
- Migrations: enums → tables/RLS → command RPCs → views. Run `npm run db:types` after the last migration of the story.
- Frontend: `lib` + `api` + `queries` (parallel) → `components` → `pages` → integration into existing screens.

### Parallel Opportunities

- Phase 1: T001, T002, T003, T005 in parallel.
- Phase 2: T008 and (T009→T010) and T011 can proceed in parallel after T006; T012 last.
- **US1 and US2 can be built fully in parallel** by different developers once Phase 2 is done.
- US3 can start in parallel with US1/US2; US4 can start in parallel too, deferring only T082's stub replacement until T062 lands.
- Within a story, all `[P]` test files and all `[P]` `lib`/`api`/`queries`/enum/view tasks run in parallel.

---

## Parallel Example: User Story 1

```bash
# Tests for US1 together:
Task: "pgTAP charge state machine in supabase/tests/003_finance_charges.test.sql"
Task: "pgTAP monthly generation in supabase/tests/003_finance_generation.test.sql"
Task: "pgTAP finance RLS in supabase/tests/003_finance_rls.test.sql"
Task: "Unit currency/period format in tests/unit/finance-format.test.ts"
Task: "E2E Cenário 1 in tests/e2e/finance.spec.ts"

# Frontend scaffolding for US1 together (after migrations + db:types):
Task: "src/features/finance/lib/currency.ts"
Task: "src/features/finance/api/charges.ts"
Task: "src/features/finance/queries/*.ts"
Task: "src/features/finance/components/DelinquencyBadge.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup.
2. Phase 2 Foundational (season lifecycle + consolidation refactor + trophy stub).
3. Phase 3 US1 Finance.
4. **STOP and VALIDATE**: quickstart Cenário 1 passes; delinquency badge never blocks access.
5. Deploy/demo — dues control is live.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 Finance → demo (MVP).
3. US2 Social Events → demo.
4. US3 Súmula Live → demo (statistics now captured live).
5. US4 Gamification → demo (cards, trophies, Raio-X, highlights).

### Parallel Team Strategy

After Phase 2: Dev A → US1, Dev B → US2, Dev C → US3, Dev D → US4 (D coordinates T082 to land right after C's T062). Each story integrates and tests independently.

---

## Notes

- `[P]` = different files, no dependency on an incomplete task.
- Every migration is versioned SQL; never edit an applied migration — add a new one.
- **One** active constitutional deviation: Principle V — súmula offline buffer (Constitution v1.1.0 makes the Financial ledger compliant under Principle III's "Internal Financial Bookkeeping" boundary). Keep the offline write path confined to `src/features/live-match/lib/offline-queue.ts`; see plan.md Complexity Tracking for its remediation/migration plan.
- Commit after each task or logical group; run `supabase test db` before pushing DB changes.
- The `seasons` extension reuses the existing MVP table — do not create a parallel Season entity.
