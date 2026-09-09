## Summary

Post-MVP expansion of the Meia Boca Juniors app across four pillars: an internal
**financial ledger** (dues, delinquency, exemptions), **social events** (churrasco /
resenha with guest count and cost split), a real-time **live súmula** (stopwatch, quick
actions, undo, offline buffer, post-match review + consolidation), and **gamification**
(EA-FC-inspired player attribute cards, an automatic trophy engine, the "Raio-X"
head-to-head card, a "Histórico & Conquistas" tab, and weekly/pre-match highlight
notifications). Everything reuses the MVP's athletes, roles, matches, presences and
`public.seasons`; no new global roles, no payment processing.

108/109 tasks complete. The only open item is **T103** — a verified Supabase production
backup, which is a human release-gate action (see *Deployment / Release Gate*).

## Delivered

### Financeiro
- `athlete_charges` ledger with `PENDING / PAID / OVERDUE / CANCELLED`; monthly automatic
  generation, manual charges, value overrides, per-athlete exemptions.
- Manual settlement + reversal + cancellation, all audited; delinquency badge that never
  blocks match access.
- Directorate panel (`/app/financeiro`, PRESIDENT) and athlete view
  (`/app/athlete/financeiro`).

### Resenhas / eventos sociais
- `social_events` + `event_presences` independent of matches; confirm/decline with a
  numeric guest count.
- Dynamic per-person split (`total_cost / (confirmed athletes + guests)`), recalculated
  until "Fechar Evento & Consolidar Rateio" freezes it. List + detail screens.

### Súmula Live
- Pre-match enable + Field Recorder assignment; stopwatch with quick actions (goal,
  assist, cards, substitution) auto-binding the current minute.
- Floating "Desfazer" (30 s window), spectator feed via Realtime, IndexedDB offline
  buffer with auto-drain on reconnect, finalize gated on an empty buffer.
- Post-match review screen (edit minute / author / assist) → explicit "Confirmar e
  Finalizar Súmula" consolidates statistics atomically and evaluates trophies.

### Gamificação
- `private.evaluate_trophies` season-scoped engine: `ARTILHEIRO` (≥10 goals), `GARCOM`
  (≥10 assists), `HAT_TRICK` (≥3 in one match), `VETERANO` (≥10 finalized matches
  played), `MURALHA` (≥5 clean sheets as sole full-match keeper). Award-once per
  `(athlete, code, season)`, never revoked, retroactive-award path covered.
- "Raio-X" head-to-head card on scheduled matches, with a "sem histórico" state.
- "Histórico & Conquistas" tab: club all-time record + trophy gallery.

### Cards de jogadores
- Premium vertical collectible card — original MBJ interpretation, **no EA/FIFA marks**,
  frame/backdrop from project SVG + tokens only. `detailed` and `compact` variants.
- Info rail (overall, pt-BR position sigla with 3-letter fallback, BR flag, MBJ crest),
  hero photo with cutout→avatar→silhouette fallback, nameplate in a self-hosted SIL OFL
  display font, `RIT/FIN/PAS/CON/DEF/FÍS` strip. Incomplete state = "—" per stat, no
  overall. `overall` is rendered verbatim from `athlete_card` (never recomputed).
- Integrated: detailed card + trophy gallery on the athlete profile; compact card as the
  roster-grid tile.

### Highlights / notificações
- `WEEKLY_HIGHLIGHTS` (weekly cron, `route=/app/historico`) and `PRE_MATCH_HIGHLIGHTS`
  (hooked into the existing ~24 h match-reminder routine, `route=/app/partidas/:matchId`)
  via `private.enqueue_notification`. `dispatch-notifications` renders both; provider
  outage is a graceful no-op.

### Temporadas
- `open_season` / `close_season` lifecycle (COACH/PRESIDENT + AAL2), one active season at
  a time; committee admin UI surfacing the active season. Trophy and statistic counters
  are scoped to the active season.

## Architecture / Important Decisions

- **Reuse of `public.seasons`** — no new season entity; trophies, leaderboards and season
  progress all scope to the existing active season.
- **`private.write_consolidation`** — extracted from `consolidate_match` (B4 refactor) so
  both the MVP consolidation path and `finalize_sumula` write match statistics through
  one code path.
- **`finalize_sumula`** — single transactional RPC: guards (IN_REVIEW, no existing
  consolidation, published lineup, athletes in lineup), derives scores from non-undone
  GOAL events, calls `write_consolidation`, inserts cards/subs, rebuilds the keeper
  timeline, calls `evaluate_trophies`, flips the setup to FINALIZED, audits.
- **Idempotency** — `private.command_results` cache for replayable commands;
  `client_event_id` unique constraint on live events; `enqueue_notification` upsert on
  `deduplication_key`; `on conflict do nothing` on trophy awards; `week_key` /
  `pre-match-highlights:<match_id>` dedup keys for highlights.
- **Offline queue restricted to Súmula Live** — the only screen with an offline write
  buffer (IndexedDB `mbj-live-sumula:<matchId>`) and the only route exempt from the
  app-shell offline `<fieldset disabled>` ("só esta tela"). Everything else stays
  online-only.
- **Realtime** — spectator feed subscribes to `postgres_changes` on `live_match_events`
  filtered by `match_id`; `undone` events drop from the list because `listEvents` filters
  `undone = false`.
- **Trophy engine inlines its aggregation** — `evaluate_trophies` (migration `160400`)
  applies before `season_scoring_leaders` (`160600`), so it mirrors that logic inline
  rather than depending on the view.
- **Reuse of the existing match-reminder** — `generate_pre_match_highlights` is invoked
  from `private.generate_attendance_reminders` with `exception when others then null`; no
  new scheduler.
- **No new global role for Field Recorder** — the recorder is a per-match assignment on
  `live_match_setups.recorder_user_id`; authorization is scoped to that match, not a
  role.

## Database

**Migrations added (31):** `20260908120100_seasons_lifecycle` … `120200_seasons_commands`
… `120400_evaluate_trophies_stub` (Phase 1–2 foundation); then the 28 feature migrations
`130100_finance_enums` → `130700_finance_views`, `140100_social_enums` →
`140500_social_views`, `145000_write_consolidation_refactor`, `150100_live_enums` →
`150700_finalize_sumula`, `160100_card_attributes` → `160700_highlights_cron`
(incl. `160650_notification_kinds` isolated so the enum values commit before any function
body references them). Full ordered list + sensitivity notes in
`docs/deployment.md` §"Feature 003 — Ordem de migração e backup".

**Tables:** `athlete_charges`, `charge_exemptions`, `social_events`, `event_presences`,
`live_match_setups`, `live_match_events`, `match_cards`, `match_substitutions`,
`match_goalkeeper_assignments`, `athlete_card_attributes`, `trophy_catalog`,
`athlete_trophies` (+ `seasons` lifecycle columns).

**Views:** `finance_overview`, `social_event_*` helpers, `club_all_time_record`,
`season_scoring_leaders`, `season_trophy_progress`, `athlete_card`,
`athlete_trophy_gallery`, `head_to_head_record` (all `security_invoker` / `stable`).

**RPCs:** `open_season`, `close_season`; `generate_monthly_dues` wrapper,
manual-charge / settle / reverse / cancel / exempt commands; `create_social_event`,
`respond_to_social_event`, `close_social_event`, `social_event_split`;
`enable_live_recording`, `assign_field_recorder`, `log_live_event`, `undo_live_event`,
`amend_live_event`, `end_live_recording`, `cancel_live_recording`, `finalize_sumula`;
`set_athlete_attributes`; `athlete_card`, `head_to_head_record`, `season_trophy_progress`,
`athlete_trophy_gallery`.

**`pg_cron` jobs:** `mbj-generate-monthly-dues` (`0 9 1 * *`),
`mbj-mark-overdue-charges` (`0 6 * * *`), `mbj-generate-weekly-highlights`
(`0 11 * * 1`). Pre-match highlights ride the existing reminder routine — no new job.

**Edge Function affected:** `supabase/functions/dispatch-notifications` — adds
`WEEKLY_HIGHLIGHTS` / `PRE_MATCH_HIGHLIGHTS` rendering with a graceful no-op on push
provider failure. Must be re-deployed with `--import-map supabase/functions/deno.json`.

## Security

- **RLS** — every new content/history table is closed: `revoke all from anon,
  authenticated` → `grant select to authenticated` → `for select … using
  (private.current_user_is_active())`. `athlete_charges` additionally restricts athletes
  to their own rows. No `insert/update/delete` policy for `authenticated` anywhere; all
  writes go through RPC.
- **`security definer` + `set search_path = ''`** on every command RPC and cron function;
  execute granted narrowly (`authenticated` for reads, `service_role` for cron).
- **AAL2** — `require_staff_aal2` / `require_president_aal2` on live-recording, finalize,
  attribute-set, season lifecycle, and all finance write commands.
- **Financial isolation** — internal bookkeeping only: records who owes, how much, when
  it was due, and whether it was marked paid. No gateway, PIX, card, boleto, checkout,
  wallet, or real money movement.
- **Field Recorder limited to the match** — authorization derives from
  `live_match_setups.recorder_user_id` for that match; there is no global role and no
  cross-match capability.
- **Offline-queue cleanup on logout / account switch** — `useLiveOfflineQueue` registers
  `queue.clear()` via `registerOfflineCleanup(userId, …)`, so the IndexedDB buffer is
  purged on the same path as the persisted query cache (`purgeRegisteredOfflineState`).
- **No PII in the offline buffer** — each pending event is
  `{athleteId, clientEventId, createdAtMs, eventType, matchId, minute, targetAthleteId,
  teamSide}`: UUIDs + enums only, no names or free text. No `console.*` / Sentry capture
  in any of the four new features.

Full detail in `specs/003-mbj-post-mvp-expansion/pr-review-notes.md`.

## Constitution

- **Principle III — compliant under Constitution v1.1.0.** The v1.1.0 amendment
  (`.specify/memory/constitution.md`, `TECH_STACK.md` §14) explicitly permits "Internal
  Financial Bookkeeping". The financial module is therefore **not** a deviation; the
  earlier treatment of it as a permanent Principle III deviation has been removed from
  the plan.
- **Principle V — the single active deviation.** Restricted to the offline persistence of
  **unsynced Súmula Live events** (IndexedDB buffer) and the single-route exemption from
  the offline write lock. Scope: "só esta tela".
- **Remediation plan documented** — `plan.md` Complexity Tracking: migrate the buffer to
  a standardized mutation queue once generic offline-sync infrastructure exists; until
  then the buffer carries no PII and is purged on logout.

## Testing

| Gate | Result |
| --- | --- |
| unit (`vitest run`) | **36 files / 205 tests PASS** |
| db (`supabase test db`, pgTAP) | **35 files / 688 tests PASS** |
| e2e (`playwright test`) | **273 passed / 5 skipped / 0 failed** |
| lint (`eslint . --max-warnings 0`) | **PASS** |
| typecheck (`tsc -b`) | **PASS** |
| build (`tsc -b && vite build`) | **PASS** |
| `db:types:check` | **current** |

Run against a fresh `supabase db reset` (T096). Pre-existing `MatchForm` "Data ou hora
inválida" console noise on two feature-002 routes is unrelated (date parsing) and those
tests pass.

## Performance / Accessibility

- **WCAG A/AA** — `tests/e2e/post-mvp-accessibility.spec.ts`: axe clean on `/app/historico`,
  `/app/resenhas`, `/app/financeiro`, `/app/partidas/:matchId/sumula`, plus the
  `detailed` and `compact` card variants (photo has a meaningful accessible name; info is
  not conveyed by colour alone). Fixed en route: two `<dl>` blocks emitting
  `<div><p><p>` → proper `<dt>/<dd>`.
- **Theme consistency** — `tests/e2e/theme-consistency.spec.ts`: the four new screens
  pass the palette-token sweep and a pt-BR label check (no `[object Object]` / fallback
  strings). Fixed en route: card components using non-token colour alphas → solid tokens
  / CSS `opacity`.
- **SC-003** — live-event latency < 2 s is exercised by `live-match-recording.spec.ts`
  (Realtime reflects the event on the same tick); "Histórico & Conquistas" added to the
  warm-nav 2 s budget loop in `performance.spec.ts`. SC-001 monthly batch is a single
  set-based INSERT (pgTAP `005_finance_commands`).
- **Roster / cards** — compact card as the grid tile behind the existing roster query
  (per-tile `athlete_card`, retry-free, identity fallback); a11y route sweep stays green.
- **PWA assets / font** — self-hosted Rajdhani (SIL OFL, 2× woff2 ≈ 15.7 KB) with
  `font-display: swap`, `--font-display` token, added to the PWA precache glob. Card SVG
  assets each within budget (`tests/unit/card-assets.test.ts`).
- **No relevant regression detected** across unit / db / e2e / lint / typecheck / build.

## Deployment / Release Gate

> ⚠️ **T103 PENDING** — before applying these migrations to production, run and confirm a
> Supabase **production** backup with status **`VERIFIED`** (trigger
> `mbj-backup-pre-migration`, wait for `VERIFIED`, record Request ID + Manifest SHA-256),
> then `supabase db push`. Procedure in `docs/deployment.md` §"Feature 003 — Ordem de
> migração e backup".

T103 is **not** checked. This feature is ready for review; it is **not** cleared for
deploy/merge until the pre-migration backup reports `VERIFIED`.

## Rollback / Recovery

Per `docs/deployment.md` / `docs/operations.md`:
- **Backup-first** — the verified pre-migration backup (age-encrypted, private R2 object,
  readback + checksum checked) is the recovery point. History tables carry immutability
  triggers, so data rollback after rows are written is infeasible — recovery is
  restore-from-backup, not down-migration.
- **Migrations are additive** — new tables / columns / functions / cron jobs only; no
  drops or destructive alters. A bad deploy is recovered by restoring the verified
  backup and re-pushing.
- **Cron** — the three new jobs can be `cron.unschedule`d individually without touching
  schema if a job misbehaves.
- **Edge Function** — `dispatch-notifications` is versioned; redeploy the previous
  version to revert notification rendering. Push provider outage is already a no-op.

## Checklist

- [x] implementação concluída (108/109 tasks)
- [x] testes técnicos verdes (unit / db / e2e / lint / typecheck / build / db:types)
- [x] documentação atualizada (`docs/operations.md`, `docs/deployment.md`, PR review note)
- [x] revisão de segurança/RLS (`pr-review-notes.md`)
- [x] a11y/theme review (`post-mvp-accessibility.spec.ts`, `theme-consistency.spec.ts`)
- [ ] production backup VERIFIED (T103)
- [ ] review/approval
- [ ] merge
- [ ] deployment

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01VCyfZSpJoH31ZXwtkoJZLf
