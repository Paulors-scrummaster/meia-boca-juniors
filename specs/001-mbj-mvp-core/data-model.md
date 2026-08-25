# Data Model: MVP Oficial do Meia Boca Juniors

## Modeling conventions

- PostgreSQL names use English `snake_case`, plural table names, UUID primary keys, and UTC
  `timestamptz` timestamps.
- All exposed tables have RLS enabled. Permissions are additive across active roles.
- Foreign-key delete behavior is explicit. Historical sporting records use `RESTRICT`, `SET NULL`, or
  logical state changes rather than cascading deletion.
- User-facing status values are represented by constrained database enums and matching generated
  TypeScript types.
- Administrative audit payloads may contain before/after business fields but never passwords, raw
  invite tokens, session tokens, or full absence reasons.

## Enumerations

| Enum | Values |
|------|--------|
| `app_role` | `PRESIDENT`, `COACH`, `ATHLETE` |
| `account_status` | `ACTIVE`, `DISABLED` |
| `athlete_status` | `ACTIVE`, `INJURED`, `SUSPENDED`, `INACTIVE` |
| `match_status` | `SCHEDULED`, `COMPLETED`, `CANCELLED` |
| `call_status` | `CALLED`, `NOT_CALLED` |
| `presence_status` | `PENDING`, `CONFIRMED`, `DECLINED` |
| `lineup_status` | `DRAFT`, `PUBLISHED`, `SUPERSEDED` |
| `lineup_assignment` | `STARTER`, `RESERVE` |
| `voting_round_status` | `OPEN`, `CLOSED`, `INVALIDATED` |
| `notification_status` | `PENDING`, `PROCESSING`, `SENT`, `FAILED`, `SKIPPED` |
| `notification_kind` | `CALL_UP`, `DEADLINE_24H`, `DEADLINE_6H`, `MATCH_CHANGED`, `LINEUP_PUBLISHED`, `VOTING_OPENED`, `NOTICE_PUBLISHED` |

## Identity and authorization

### `profiles`

Application account metadata associated one-to-one with the managed authentication identity.

| Field | Rule |
|-------|------|
| `id` | UUID primary key and foreign key to the authentication user |
| `account_status` | Required; defaults to `ACTIVE` |
| `must_change_password` | Required boolean; set after an administrative password reset |
| `created_at`, `updated_at` | Required UTC timestamps |
| `disabled_at` | Nullable; required when account is disabled |

An account with `DISABLED` status has no application access even if role rows remain for historical
reference. E-mail and password data stay exclusively in the authentication service.

### `user_roles`

Supports additive multi-role permissions.

| Field | Rule |
|-------|------|
| `user_id` | Foreign key to `profiles.id`, `ON DELETE RESTRICT` |
| `role` | `app_role` |
| `assigned_by` | Foreign key to `profiles.id`, `ON DELETE RESTRICT` |
| `assigned_at` | Required UTC timestamp |

Primary key: `(user_id, role)`.

Inactivating an athlete removes only the `ATHLETE` role. `PRESIDENT` and `COACH` rows remain active.

### `athletes`

Sporting identity, optionally linked to an application account.

| Field | Rule |
|-------|------|
| `id` | UUID primary key |
| `user_id` | Nullable unique foreign key to `profiles.id`, `ON DELETE SET NULL` |
| `full_name` | Required normalized text from 2 through 120 characters |
| `shirt_name` | Required normalized text from 1 through 40 characters |
| `shirt_number` | Required integer from 1 through 99 |
| `primary_position` | Required normalized text from 2 through 40 characters |
| `status` | Required `athlete_status`, defaults to `ACTIVE` |
| `photo_path` | Nullable private-storage object path; never a permanent public URL |
| `created_at`, `updated_at` | Required UTC timestamps |
| `inactivated_at` | Nullable UTC timestamp |
| `anonymized_at` | Nullable UTC timestamp |

Constraints:

- Partial unique index on `shirt_number` where `status <> 'INACTIVE'` and `anonymized_at IS NULL`.
- `inactivated_at` is required exactly when `status = 'INACTIVE'`.
- Anonymization replaces personal names/photo linkage while leaving the stable athlete ID referenced by
  historical records.

### `athlete_invites`

Single-use credential connecting a pre-created athlete with a new account.

| Field | Rule |
|-------|------|
| `id` | UUID primary key |
| `athlete_id` | Foreign key to `athletes.id`, `ON DELETE RESTRICT` |
| `auth_user_id` | Nullable unique authentication user created for the invitation |
| `email_normalized` | Required normalized recipient e-mail, President-only visibility |
| `created_by` | Foreign key to `profiles.id`, `ON DELETE RESTRICT` |
| `created_at` | Required UTC timestamp |
| `redeemed_at`, `revoked_at` | Nullable and mutually exclusive |
| `redeemed_by` | Nullable foreign key to `profiles.id`, `ON DELETE RESTRICT` |

A partial unique index allows only one unredeemed, unrevoked logical invite per athlete. The logical
record remains valid until redemption or revocation, but each physical Supabase action link is
short-lived. Re-send generates a fresh action link for delivery by WhatsApp without creating a second
logical activation. Raw action tokens are never stored. Revocation disables the pending Auth identity
and blocks final linkage; this cross-service operation is idempotent because Auth Admin and PostgreSQL
cannot participate in one atomic transaction.

### `private.rate_limit_counters`

Internal fixed-window counters used only by trusted functions. The table is not exposed through the
Data API.

| Field | Rule |
|-------|------|
| `scope` | Controlled operation identifier |
| `subject_hash` | Keyed hash or technical UUID; never a raw IP address or e-mail |
| `window_started_at` | Required UTC timestamp |
| `attempt_count` | Required non-negative integer |
| `updated_at` | Required UTC timestamp |

Primary key: `(scope, subject_hash, window_started_at)`. A private transactional helper increments and
tests the counter atomically. Old windows may be purged without affecting business history.

## Seasons and matches

### `seasons`

| Field | Rule |
|-------|------|
| `id` | UUID primary key |
| `year` | Unique four-digit year |
| `is_active` | Required boolean; at most one active season |
| `created_at` | Required UTC timestamp |

### `matches`

| Field | Rule |
|-------|------|
| `id` | UUID primary key |
| `season_id` | Foreign key to `seasons.id`, `ON DELETE RESTRICT` |
| `opponent_name` | Required normalized text from 2 through 120 characters |
| `competition_name` | Nullable normalized text with at most 120 characters |
| `location_name` | Nullable normalized text with at most 160 characters |
| `match_date` | Required UTC timestamp |
| `confirmation_deadline` | Required UTC timestamp earlier than `match_date` |
| `status` | Required `match_status`, defaults to `SCHEDULED` |
| `schedule_revision` | Required positive integer, incremented by each date/time change |
| `current_consolidation_id` | Nullable pointer to the current valid `match_consolidations` revision |
| `created_by`, `updated_by` | Foreign keys to `profiles.id`, `ON DELETE RESTRICT` |
| `created_at`, `updated_at` | Required UTC timestamps |

A scheduled match whose kickoff has passed can be consolidated, which changes it to `COMPLETED` in
the same transaction. A completed match with a current consolidation can be reopened. A cancelled
match cannot accept athlete responses, lineup publication, consolidation, or voting until reactivated.

### `match_presences`

One call/response record per athlete and match.

| Field | Rule |
|-------|------|
| `id` | UUID primary key |
| `match_id` | Foreign key to `matches.id`, `ON DELETE RESTRICT` |
| `athlete_id` | Foreign key to `athletes.id`, `ON DELETE RESTRICT` |
| `call_status` | Required `call_status` |
| `presence_status` | Required `presence_status`, defaults to `PENDING` |
| `called_at` | Nullable UTC timestamp until first call; refreshed whenever the athlete transitions from `NOT_CALLED` to `CALLED` and retained as history if later removed |
| `call_revision` | Required non-negative integer, defaults to 0 and increments on every transition into `CALLED`; a currently or previously called row has value at least 1 |
| `is_exceptional_call` | Required boolean, defaults to false |
| `individual_deadline` | Nullable UTC timestamp; required for an exceptional call and no later than `match_date` |
| `responded_at` | Nullable UTC timestamp |
| `last_changed_by` | Nullable foreign key to `profiles.id`, `ON DELETE RESTRICT` |
| `updated_at` | Required UTC timestamp |

Constraints:

- Unique `(match_id, athlete_id)`.
- `call_revision = 0` requires `called_at IS NULL`; `call_revision > 0` requires `called_at IS NOT NULL`.
- `DECLINED` requires a related non-blank justification; other statuses have no justification row.
- An exceptional call requires an individual deadline after its creation and no later than kickoff.
- Athlete writes use the general deadline unless an active individual exceptional deadline applies.
- President/Coach changes are allowed until consolidation or after President-only reopening.
- General and exceptional call commands require an active Athlete role and reject `INACTIVE`; sporting
  states `INJURED` and `SUSPENDED` remain callable because their restriction applies to lineups.

### `presence_justifications`

Separated from presence state so ordinary roster visibility cannot accidentally expose the text.

| Field | Rule |
|-------|------|
| `presence_id` | Primary key and foreign key to `match_presences.id`, `ON DELETE CASCADE` |
| `reason` | Required normalized text from 1 through 500 characters |
| `created_by` | Foreign key to `profiles.id`, `ON DELETE RESTRICT` |
| `created_at`, `updated_at` | Required UTC timestamps |

Only the owning athlete, President, and Coach can select this table. Presence-state views exposed to
the roster do not join it. Confirming presence deletes the related justification in the same command.

## Lineups

### `lineups`

Versioned tactical lineup for a match.

| Field | Rule |
|-------|------|
| `id` | UUID primary key |
| `match_id` | Foreign key to `matches.id`, `ON DELETE RESTRICT` |
| `revision` | Positive integer unique within a match |
| `formation_code` | Required foreign key to active `allowed_formations.code`, `ON DELETE RESTRICT` |
| `status` | Required `lineup_status` |
| `created_by`, `published_by` | Creator required; publisher nullable until publication |
| `created_at`, `published_at` | Creation required; publication nullable until publication |

Partial unique index: one `PUBLISHED` lineup per match. Publishing a new revision atomically marks the
previous published revision as `SUPERSEDED`.

### `allowed_formations`

Small club-controlled reference table seeded with `4-4-2`, `4-3-3`, `4-2-3-1`, and `3-5-2`.

| Field | Rule |
|-------|------|
| `code` | Primary key, normalized text from 1 through 20 characters |
| `display_order` | Required non-negative unique integer |
| `is_active` | Required boolean, defaults to true |

Published lineups reference an active allowed formation. The database reference is authoritative;
`club.config.ts` mirrors the same initial choices for typed UI presentation.

### `lineup_players`

| Field | Rule |
|-------|------|
| `lineup_id` | Foreign key to `lineups.id`, `ON DELETE CASCADE` for draft/version ownership |
| `athlete_id` | Foreign key to `athletes.id`, `ON DELETE RESTRICT` |
| `assignment` | `STARTER` or `RESERVE` |
| `tactical_position` | Required for starters, optional for reserves |
| `position_x`, `position_y` | Nullable normalized coordinates from 0 through 100; required for starters |
| `display_order` | Non-negative integer for deterministic reserve ordering |

Primary key: `(lineup_id, athlete_id)`. Publishing validates that no member is inactive, injured,
suspended, or declined for the match.

## Statistics and voting

### `match_consolidations`

Immutable revision of the official result. The match points to at most one current valid revision.

| Field | Rule |
|-------|------|
| `id` | UUID primary key |
| `match_id` | Foreign key to `matches.id`, `ON DELETE RESTRICT` |
| `lineup_id` | Required foreign key to the published `lineups.id` revision used at consolidation, `ON DELETE RESTRICT` |
| `revision` | Positive integer unique within a match |
| `mbj_score`, `opponent_score` | Required non-negative integers |
| `status` | `VALID` or `INVALIDATED` |
| `idempotency_key` | Unique key scoped to the match command |
| `consolidated_by`, `consolidated_at` | Required President and UTC timestamp |
| `invalidated_by`, `invalidated_at` | Nullable President and UTC timestamp |

Only the row referenced by `matches.current_consolidation_id` contributes to current rankings.
Reopening clears that pointer and marks the prior revision invalid without deleting it. Candidate
eligibility always resolves through the consolidation's immutable `lineup_id`, never through a later
published lineup.

### `match_goals`

Official MBJ goal contributions belonging to the current statistics revision.

| Field | Rule |
|-------|------|
| `id` | UUID primary key |
| `consolidation_id` | Foreign key to `match_consolidations.id`, `ON DELETE RESTRICT` |
| `scorer_athlete_id` | Nullable FK to `athletes.id`; null represents an opponent own goal |
| `assistant_athlete_id` | Nullable FK to `athletes.id`; must differ from scorer |
| `sequence_number` | Positive integer unique within the consolidation |
| `is_opponent_own_goal` | Required boolean; true exactly when scorer is null |
| `created_by`, `created_at` | Required audit identity and UTC timestamp |

For each consolidation, goal rows must equal `mbj_score`. Opponent goals are represented by
`opponent_score` only because individual opponent statistics are outside scope. Invalidating the
parent consolidation excludes all its contributions without mutating goal history.

Season rankings are calculated from valid goal contributions plus finalized presence records; they
are not maintained as mutable counter columns.

### `mvp_voting_rounds`

| Field | Rule |
|-------|------|
| `id` | UUID primary key |
| `consolidation_id` | Unique foreign key to `match_consolidations.id`, `ON DELETE RESTRICT` |
| `status` | Required `voting_round_status` |
| `opens_at`, `closes_at` | Required UTC timestamps exactly 24 hours apart |
| `created_by` | President who consolidated the revision |
| `invalidated_at`, `closed_at` | Nullable lifecycle timestamps |

Only one round for the current consolidation may be `OPEN`. Reopening invalidates the active/closed
round; reconsolidation creates a new immutable consolidation and voting round.

### `mvp_votes`

| Field | Rule |
|-------|------|
| `id` | UUID primary key |
| `voting_round_id` | Foreign key to `mvp_voting_rounds.id`, `ON DELETE RESTRICT` |
| `voter_athlete_id` | Foreign key to `athletes.id`, `ON DELETE RESTRICT` |
| `voted_athlete_id` | Foreign key to `athletes.id`, `ON DELETE RESTRICT` |
| `created_at` | Required UTC timestamp |

Constraints:

- Unique `(voting_round_id, voter_athlete_id)`.
- Voter and candidate must differ.
- Both must be authorized by server identity/rules; the candidate must belong to the published lineup
  used by the round.
- Inserts are accepted only while the round is `OPEN` and before `closes_at`.
- Votes in an `INVALIDATED` round remain historical and do not conflict with the unique vote allowed
  to the same athlete in a later valid round created by reconsolidation.

### `mvp_awards`

| Field | Rule |
|-------|------|
| `voting_round_id` | Foreign key to `mvp_voting_rounds.id`, `ON DELETE RESTRICT` |
| `athlete_id` | Foreign key to `athletes.id`, `ON DELETE RESTRICT` |
| `vote_count` | Non-negative integer |
| `awarded_at` | Required UTC timestamp |
| `invalidated_at` | Nullable; set if the match revision is reopened |

Primary key: `(voting_round_id, athlete_id)`. Closing inserts one row for every athlete tied at the
maximum positive vote count. A zero-vote round creates no award.

## Notices and notifications

### `notices`

| Field | Rule |
|-------|------|
| `id` | UUID primary key |
| `title` | Required normalized text from 1 through 100 characters |
| `body` | Required normalized text from 1 through 2,000 characters |
| `published_by` | Foreign key to `profiles.id`, `ON DELETE RESTRICT` |
| `published_at` | Required UTC timestamp |

### `push_subscriptions`

| Field | Rule |
|-------|------|
| `id` | UUID primary key |
| `user_id` | Foreign key to `profiles.id`, `ON DELETE CASCADE` |
| `provider_subscription_id` | Unique opaque provider identifier |
| `is_enabled` | Required boolean |
| `last_seen_at`, `created_at`, `updated_at` | UTC timestamps |

Provider identifiers are never returned to other users. A user may have more than one device.

### `notification_events`

Transactional outbox record created with the business event.

| Field | Rule |
|-------|------|
| `id` | UUID primary key |
| `kind` | Required `notification_kind` |
| `resource_type`, `resource_id` | Required logical event subject |
| `deduplication_key` | Unique deterministic key |
| `payload` | Minimal JSON data without secrets or unnecessary PII |
| `created_at` | Required UTC timestamp |

Call-up keys include match, schedule revision, athlete, and `call_revision`; reminder keys include
presence, schedule revision, `call_revision`, and reminder kind. This deduplicates retries without
suppressing a legitimate re-call.

### `notification_deliveries`

| Field | Rule |
|-------|------|
| `id` | UUID primary key |
| `event_id` | Foreign key to `notification_events.id`, `ON DELETE RESTRICT` |
| `user_id` | Foreign key to `profiles.id`, `ON DELETE RESTRICT` |
| `status` | Required `notification_status` |
| `attempt_count` | Non-negative integer |
| `last_error_code` | Nullable safe operational code, never raw sensitive payload |
| `next_attempt_at`, `sent_at`, `updated_at` | Nullable/required lifecycle timestamps |

Unique `(event_id, user_id)` prevents duplicate recipient deliveries. Notification failure never
rolls back the associated business transaction.

## Audit

### `audit_logs`

| Field | Rule |
|-------|------|
| `id` | UUID primary key |
| `actor_user_id` | Foreign key to `profiles.id`, `ON DELETE RESTRICT` |
| `action` | Required controlled action code |
| `resource_type`, `resource_id` | Required affected resource reference |
| `before_state`, `after_state` | Nullable sanitized JSON snapshots |
| `trace_id` | Required correlation identifier |
| `created_at` | Required UTC timestamp; immutable |

Clients can never insert, update, or delete audit rows directly. Only approved server-side commands
write them. Absence reasons are represented by change indicators rather than copied verbatim.

## Derived views

- `next_match_view`: next scheduled match and the current user's call/presence summary.
- `published_lineup_view`: current published lineup with only the fields required by players/offline.
- `staff_attendance_view`: authorized staff overview with presence states and protected reasons.
- `season_rankings_view`: goals, assists, finalized presences, and valid MVP awards by season.
- `open_mvp_voting_view`: active round plus candidates from its published lineup, excluding the caller.

Views retain the same RLS/authorization intent as their underlying data and expose the minimum fields
required by each client screen.

## State transitions

### Athlete

```text
ACTIVE <-> INJURED
ACTIVE <-> SUSPENDED
INJURED/SUSPENDED -> INACTIVE
ACTIVE -> INACTIVE
```

Returning an inactive athlete to active requires a currently free shirt number and an explicit role
assignment; it does not silently restore prior application roles.

### Match

```text
SCHEDULED <-> CANCELLED
SCHEDULED (kickoff passed) -> COMPLETED (consolidated)
COMPLETED (consolidated) -> COMPLETED (reopened)
COMPLETED (reopened) -> COMPLETED (reconsolidated)
```

Reactivation returns a cancelled future match to `SCHEDULED`. A completed match cannot return to
scheduled in the MVP.

### Presence

```text
PENDING -> CONFIRMED
PENDING -> DECLINED
CONFIRMED <-> DECLINED        # while applicable deadline is open
CONFIRMED/DECLINED -> PENDING # match date/time rescheduled
any -> any                    # audited staff override before consolidation or after reopening
```

### Lineup

```text
DRAFT -> PUBLISHED -> SUPERSEDED
```

Published revisions are immutable. Editing creates a new draft revision.

### Voting round

```text
OPEN -> CLOSED
OPEN/CLOSED -> INVALIDATED # match reopened
```

## RLS capability matrix

| Resource | Visitor | Athlete | Coach | President |
|----------|---------|---------|-------|-----------|
| Public entry screens | Read | Read | Read | Read |
| Own profile/session | — | Read/update allowed fields | Read/update allowed fields | Read/update allowed fields |
| Roles/invites/accounts | — | — | — | Manage |
| Athlete sporting profiles | — | Read | Read | Manage |
| Matches | — | Read | Manage | Manage |
| Presence states | — | Read; write own before deadline | Manage until consolidation | Manage until consolidation/reopen |
| Other absence reasons | — | No | Read | Read |
| Lineups | — | Read published | Manage | Manage |
| Statistics | — | Read | Read | Consolidate/reopen/manage |
| MVP votes | — | Create own/read permitted result | Only with Athlete role | Only with Athlete role |
| Notices | — | Read | Publish/read | Publish/read |
| Audit logs | — | — | — | Read administrative trail |

All capabilities also require an active account. Athlete-only capabilities additionally require an
active `ATHLETE` role and an eligible athlete profile.
