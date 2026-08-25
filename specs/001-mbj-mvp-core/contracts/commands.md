# Command Contracts

This document defines application-facing command boundaries. Table reads use typed, RLS-protected
queries/views. Commands below contain privileged, multi-step, or externally integrated behavior and
must not be reconstructed as sequences of client writes.

## Common contract

All authenticated commands derive the actor from the verified session and ignore client-supplied
actor/role identity.

Successful result:

```json
{
  "data": {},
  "traceId": "uuid"
}
```

Safe failure:

```json
{
  "error": {
    "code": "STABLE_ERROR_CODE",
    "message": "Mensagem segura em português",
    "fieldErrors": {}
  },
  "traceId": "uuid"
}
```

Expected error codes include `UNAUTHENTICATED`, `MFA_REQUIRED`, `FORBIDDEN`, `NOT_FOUND`,
`VALIDATION_ERROR`, `CONFLICT`, `DEADLINE_CLOSED`, `MATCH_LOCKED`, `OFFLINE`,
`RATE_LIMITED`, and `INTEGRATION_UNAVAILABLE`. SQL, stack traces, tokens, invitation values,
provider payloads, and personal data never appear in the response.

Every retryable state-changing command accepts an idempotency key generated once per user action.
Supabase Auth owns e-mail/password throttling. Edge Functions additionally consume the private
per-actor/per-operation limits defined in the plan and return `RATE_LIMITED` without persisting raw IP
addresses or personal identifiers as counter keys.

## Edge Function contracts

### `POST /functions/v1/athlete-invitations/manage`

**Authorization**: active President role plus AAL2.

**Request**:

```json
{
  "operation": "CREATE | RESEND | REVOKE",
  "athleteId": "uuid",
  "email": "jogador@example.com",
  "idempotencyKey": "uuid"
}
```

For `RESEND` and `REVOKE`, e-mail is omitted and the active logical invite is resolved by athlete.

**Response for create/resend**:

```json
{
  "data": {
    "invitationId": "uuid",
    "deliveryLink": "short-lived action URL",
    "logicalStatus": "PENDING"
  },
  "traceId": "uuid"
}
```

The President copies the link to WhatsApp. The application does not e-mail it. The function never
stores the raw action URL/token. Revocation returns the invitation ID and `REVOKED` status and is
idempotent even if the pending Auth identity was already disabled.

### `POST /functions/v1/athlete-invitations/accept`

**Authorization**: authenticated invited user; normal application access is not yet required.

**Request**:

```json
{
  "invitationId": "uuid"
}
```

**Atomic database result**:

- invitation is pending and locked for update;
- authenticated user matches `auth_user_id` expected by the invitation;
- athlete has no different linked user;
- profile is activated, athlete is linked, and `ATHLETE` role is assigned;
- invitation is marked redeemed exactly once.

**Response**: athlete ID, active roles, and `mustChangePassword` state.

### `POST /functions/v1/admin-reset-password`

**Authorization**: active President role plus AAL2.

**Request**:

```json
{
  "userId": "uuid",
  "temporaryPassword": "string",
  "idempotencyKey": "uuid"
}
```

The function updates the managed authentication password, sets `must_change_password`, revokes other
sessions when supported, and appends an audit event without recording the password. Partial failure is
tracked for safe retry because Auth Admin and PostgreSQL are not one transaction.

### `POST /functions/v1/push-identity`

**Authorization**: authenticated active account.

**Request**: empty. The function ignores any client-supplied identity field.

**Response**:

```json
{
  "data": {
    "externalId": "authenticated-technical-user-uuid",
    "identityToken": "short-lived-signed-token"
  },
  "traceId": "uuid"
}
```

The function derives `externalId` from the verified session, applies the approved per-user rate limit,
and never includes a name, e-mail, role, provider subscription, or other personal data. The token is
never logged. Preview origins cannot obtain credentials for the production OneSignal application.

### `POST /functions/v1/dispatch-notifications`

**Authorization**: internal scheduled secret only; never browser callable.

**Request**: optional bounded batch size. The worker claims pending deliveries, sends through the push
adapter with identity verification, and records `SENT`, `FAILED`, or `SKIPPED`. It returns aggregate
counts and safe error codes only.

## PostgreSQL RPC contracts

### `respond_to_call`

**Caller**: active Athlete acting on their own `match_presences` row.

**Input**: `match_id`, target status `CONFIRMED|DECLINED`, optional reason, idempotency key.

**Rules**:

- caller maps to the row's athlete;
- match is scheduled and the athlete is called;
- current time is before general deadline or valid individual exceptional deadline;
- declined requires a non-blank bounded reason; confirmed removes the protected justification;
- one resulting state is committed and notification/audit metadata is updated.

**Output**: presence ID, status, applicable deadline, responded timestamp, and match schedule revision.

### `admin_set_presence`

**Caller**: President or Coach with AAL2.

**Input**: `match_id`, `athlete_id`, target status, optional reason, explanation, idempotency key.

**Rules**: match is not cancelled; current consolidation is absent; reason privacy is preserved; the
override and actor are audited. If consolidated, returns `MATCH_LOCKED` until President reopens it.

### `set_match_callups`

**Caller**: President or Coach with AAL2.

**Input**: match ID, the complete deduplicated list of called athlete IDs, and idempotency key.

**Rules/result**:

- lock a scheduled, non-consolidated match;
- validate an active Athlete role and reject `INACTIVE`, while not applying lineup-only restrictions
  to `INJURED` or `SUSPENDED` athletes;
- create exactly one `match_presences` row for every newly called athlete as `CALLED` and `PENDING`,
  set `called_at` to the transaction time, and increment `call_revision` on every legitimate re-call;
- mark removed athletes `NOT_CALLED`, reset their response, and delete obsolete justification rows;
- preserve unchanged called-athlete responses;
- append a sanitized audit record for the before/after called set;
- insert one `CALL_UP` event for each new call revision in the same transaction; retries for the same
  call revision are deduplicated, while a later legitimate re-call creates a new event.

Repeating the same idempotency key returns the prior result without duplicating presence rows, audits,
events, or deliveries.

### `reschedule_match`

**Caller**: President or Coach with AAL2.

**Input**: match ID, new date/time, general deadline, optional changed descriptive fields, idempotency
key.

**Rules/result**:

- lock match;
- validate deadline before kickoff;
- if date/time changed, increment schedule revision, reset every called athlete to `PENDING`, delete
  prior justifications, and invalidate/recalculate exceptional deadlines that exceed kickoff;
- descriptive-only changes do not reset responses;
- append audit and deduplicated reconfirmation notification event in the same transaction.

**Output**: match ID, schedule revision, number of reset responses, and notification event ID.

### `create_exceptional_call`

**Caller**: President or Coach with AAL2.

**Input**: match ID, athlete ID, individual deadline, idempotency key.

**Rules**: general deadline has passed; match has not started; individual deadline is in the future and
no later than kickoff; the target has an active Athlete role and is not inactive. Creates/updates the
single presence row as `CALLED` and `PENDING`, refreshes `called_at`, increments `call_revision`, and
creates an event unique to that call revision.

### `publish_lineup`

**Caller**: President or Coach with AAL2.

**Input**: match ID, draft lineup ID, idempotency key.

**Rules**: validate each athlete against current sporting/presence state; lock the match; mark the prior
published revision `SUPERSEDED`; publish the draft immutably; create one notification event.

**Output**: lineup ID, revision, published timestamp.

### `consolidate_match`

**Caller**: President with AAL2.

**Input**:

```json
{
  "matchId": "uuid",
  "mbjScore": 0,
  "opponentScore": 0,
  "goals": [
    {
      "sequence": 1,
      "scorerAthleteId": "uuid-or-null",
      "assistantAthleteId": "uuid-or-null",
      "isOpponentOwnGoal": false
    }
  ],
  "idempotencyKey": "uuid"
}
```

**Rules/result**:

- lock a non-cancelled match whose kickoff has passed and require no current valid consolidation;
- require the current published lineup and persist that exact immutable `lineup_id` on the new
  consolidation revision;
- require goal count to equal MBJ score and validate scorer/assistant rules;
- create immutable consolidation revision and goal rows;
- set match status to `COMPLETED` and its current-consolidation pointer;
- create voting round from transaction time through exactly 24 hours later;
- append audit and voting-open notification event atomically.

Repeated idempotency key returns the original revision without duplicate statistics or notification.

### `reopen_match_statistics`

**Caller**: President with AAL2.

**Input**: match ID, mandatory correction explanation, idempotency key.

**Rules/result**: lock match; invalidate current consolidation, voting round, and awards; clear current
pointer; preserve all revision rows; unlock attendance/result correction; audit before/after identity.
There is no destructive delete.

### `cast_mvp_vote`

**Caller**: active user with active Athlete role.

**Input**: voting round ID, candidate athlete ID, idempotency key.

**Rules**: round belongs to current valid consolidation, is open and before deadline; caller maps to the
voter athlete; candidate is a starter/reserve in the immutable lineup revision referenced by the
consolidation;
candidate differs from voter; one vote per voter/round.

**Output**: vote ID and creation timestamp. Vote totals remain hidden until the product's selected
result-display state.

### `close_mvp_voting`

**Caller**: scheduled internal database job; President may invoke an idempotent recovery action.

**Rules/result**: lock expired open round; calculate maximum votes; insert awards for every top-tied
candidate when maximum is positive; mark round closed; append audit/notification metadata.

## Read contracts

| Query/view | Audience | Data contract |
|------------|----------|---------------|
| `next_match_view` | Authenticated roles | Next scheduled match, caller's call/presence state, deadline, no protected reason |
| `published_lineup_view` | Authenticated roles | Current published formation and minimum athlete display fields |
| `staff_attendance_view` | President/Coach+AAL2 | Called athletes, states, deadlines, and protected reasons |
| `season_rankings_view` | Authenticated roles | Current valid goals, assists, finalized presence totals, MVP awards |
| `open_mvp_voting_view` | Active Athlete | Current round and published-lineup candidates excluding caller |

Every view uses invoker security behavior or an equivalent RLS-preserving contract and returns only
the columns required by its screen.
