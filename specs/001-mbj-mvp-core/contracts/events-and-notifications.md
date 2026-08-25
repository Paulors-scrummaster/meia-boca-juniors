# Events, Realtime, and Notification Contracts

## Principles

- Database state is authoritative; realtime and push are delivery mechanisms only.
- A failed external notification never rolls back its originating business command.
- Every event and recipient delivery is idempotent through deterministic unique keys.
- Payloads contain display-safe identifiers/text only—never passwords, tokens, invitation links,
  absence reasons, e-mail addresses, or administrative before/after snapshots.
- Preview environments do not initialize the production push application.

## Outbox event envelope

```json
{
  "eventId": "uuid",
  "kind": "CALL_UP",
  "resource": {
    "type": "match",
    "id": "uuid"
  },
  "deduplicationKey": "match:<id>:schedule:<revision>:call-up:<athlete-id>",
  "occurredAt": "UTC timestamp",
  "display": {
    "title": "Nova convocação",
    "body": "Você foi convocado para a próxima partida.",
    "route": "/matches/<id>"
  }
}
```

Routes are application-relative allowlisted paths. Provider responses and subscription identifiers are
stored only in protected delivery records.

## Event catalog

| Kind | Created by | Recipients | Deduplication basis |
|------|------------|------------|---------------------|
| `CALL_UP` | General or exceptional call transaction | Newly called athlete | match + schedule revision + athlete |
| `DEADLINE_24H` | Scheduled reminder scan | Pending called athlete | presence + deadline revision + kind |
| `DEADLINE_6H` | Scheduled reminder scan | Pending called athlete | presence + deadline revision + kind |
| `MATCH_CHANGED` | Date/time reschedule transaction | Called athletes | match + schedule revision |
| `LINEUP_PUBLISHED` | Lineup publication transaction | Active roster | lineup revision |
| `VOTING_OPENED` | Consolidation transaction | Active Athlete-role users | voting round |
| `NOTICE_PUBLISHED` | Notice publication transaction | Active roster | notice ID |

“24H” and “6H” mean before the applicable confirmation deadline, not before kickoff. Exceptional calls
use their individual deadline. Supabase Cron runs the reminder scan every 5 minutes. Each reminder is
eligible from its exact target instant through 10 minutes after that instant; a scan skips reminders
whose target preceded creation of the call or whose operational window was missed. The deterministic
key includes the presence, deadline revision, and reminder kind, so overlapping scans remain harmless.

## Dispatch lifecycle

```text
PENDING -> PROCESSING -> SENT
                      -> FAILED -> PENDING (bounded retry)
                      -> SKIPPED
```

- Claiming uses row locking so concurrent workers do not send the same delivery.
- Retry is limited with exponential delay for transient provider failures.
- Permanent invalid subscription/permission errors mark `SKIPPED` and disable that subscription.
- After the retry limit, status remains `FAILED`, the user still sees in-app pending state, and an
  operational metric/alert is emitted.
- The provider adapter receives a stable external user identity protected by server-generated identity
  verification.

## Push permission UX

1. Core flows are available before permission is requested.
2. After login, a contextual in-app explanation offers “Ativar notificações”.
3. Browser permission is requested only after that user gesture.
4. Denial is remembered as UI preference without blocking later manual enablement.
5. On supported iPhone/iPad where the PWA is not installed, show “Adicionar à Tela de Início” guidance
   instead of an ineffective permission prompt.
6. Login obtains a short-lived signed identity token from the authenticated `push-identity` Edge
   Function and binds the provider subscription to the current technical user ID.
7. Logout unbinds the provider identity before private client state is cleared.

## Service-worker contract

| Worker | Path | Scope | Responsibility |
|--------|------|-------|----------------|
| PWA/Workbox | generated root worker | `/` | app shell, navigation fallback, hashed static assets |
| OneSignal | `/push/onesignal/OneSignalSDKWorker.js` | `/push/onesignal/` | push receipt/display only |

Both workers are HTTPS, same-origin, publicly fetchable, and return JavaScript—not the SPA fallback.
The OneSignal path is stable. The PWA worker never runtime-caches authenticated API/Auth responses.

## Realtime contract

### Published change sources

- match schedule/status/current consolidation pointer;
- roster-visible presence state, without protected justification;
- current published lineup revision;
- notice publication.

### Client behavior

1. Subscribe only while an authenticated screen needs the signal.
2. On event, validate resource ID and invalidate the relevant TanStack query key.
3. Re-fetch through the normal RLS-protected read contract.
4. Unsubscribe on screen disposal/logout.
5. Realtime disconnect displays no fatal error; normal refetch-on-focus/reconnect restores freshness.

Realtime payloads are never trusted as authorization evidence and are never copied into Zustand.

## Operational metrics

Only aggregate operational measurements are retained:

- pending presence count by match;
- notification deliveries by kind/status;
- reminder generation count;
- last successful dispatch time;
- failed delivery count and safe provider code.

No clickstream, page-view history, marketing profile, or notification message body is collected as an
analytics event.

## Acceptance tests

- Repeating a business command creates one event and one delivery per recipient.
- Provider outage leaves business data committed and marks delivery retryable/failed.
- Disabled push still leaves the same in-app pending indicator.
- Rescheduling uses a new revision key and generates a new reconfirmation notification once.
- Protected reason/e-mail/token fields never appear in events, realtime payloads, logs, or provider
  metadata.
- Production subscriptions are not created on preview or `pages.dev` origins.
