# Offline Cache Contract

## Allowed documents

Exactly two query families may be persisted:

```text
['offline', <user-id>, 'next-match']
['offline', <user-id>, 'published-lineup', <match-id>]
```

No other query or mutation is eligible. Eligibility is expressed through explicit query metadata and
enforced by the persistence dehydration filter.

## Next-match DTO

```ts
interface OfflineNextMatch {
  schemaVersion: 1;
  cachedAt: string;
  match: {
    id: string;
    opponentName: string;
    matchDate: string;
    locationName: string | null;
    competitionName: string | null;
    status: 'SCHEDULED';
  };
  myCall: {
    callStatus: 'CALLED' | 'NOT_CALLED';
    presenceStatus: 'PENDING' | 'CONFIRMED' | 'DECLINED' | null;
    applicableDeadline: string | null;
  };
}
```

The DTO never contains an absence reason, e-mail, role list, invite, token, push identifier, audit data,
or another athlete's presence.

## Published-lineup DTO

```ts
interface OfflinePublishedLineup {
  schemaVersion: 1;
  cachedAt: string;
  matchId: string;
  lineup: {
    revision: number;
    formationCode: string;
    publishedAt: string;
    starters: Array<{
      athleteId: string;
      shirtName: string;
      shirtNumber: number;
      tacticalPosition: string;
      positionX: number;
      positionY: number;
    }>;
    reserves: Array<{
      athleteId: string;
      shirtName: string;
      shirtNumber: number;
      displayOrder: number;
    }>;
  };
}
```

Only sporting display fields needed in the locker-room view are included. Photos are not required for
offline correctness.

## Persistence policy

| Setting | Contract |
|---------|----------|
| Storage | Browser local storage through TanStack's synchronous persister |
| Key | `mbj:query-cache:v1:<user-id>` |
| Buster | Includes cache/schema version and club deployment ID |
| Maximum age | 24 hours initially |
| Garbage collection | At least the maximum age |
| Query filter | Successful query and `meta.persistOffline === true` |
| Mutation filter | Always false |

The persister is created only after the authenticated user is known. Stored content is treated as
untrusted input and must satisfy its DTO schema before rendering.

## Lifecycle

### Hydration

1. Resolve the authenticated session and user ID.
2. Create the per-user persister and query client boundary.
3. Restore only compatible, unexpired data.
4. Render cached content with “Modo Offline” and `cachedAt` when fresh network data is unavailable.
5. A successful online response replaces the DTO and its timestamp.

### Purge

On logout, account disablement, session invalidation, or user switch:

1. prevent new persistence;
2. cancel active queries;
3. clear in-memory query state;
4. remove the persisted client key;
5. unbind push identity;
6. render no authenticated route until the new identity boundary is established.

Multi-tab session events must trigger the same purge in every open tab.

## Connectivity and writes

- Browser online/offline signals are advisory and combined with actual request results.
- While offline, write controls are visibly disabled and explain that reconnection is required.
- No mutation queue is persisted or replayed.
- An accidental write invocation uses no retry and cannot remain paused for later execution.
- Reconnection invalidates the two online queries before enabling time-sensitive actions.
- Server deadlines and authorization remain authoritative after reconnection.

## Service-worker exclusion

Authenticated Supabase/Auth routes use NetworkOnly behavior or are outside runtime caching. Cache
Storage may contain only the app shell and approved static assets. This prevents a second business-data
cache that would outlive the TanStack purge policy.

## Acceptance tests

- Inspecting the serialized client reveals only the two DTO families and permitted fields.
- Cache from user A is never rendered after user B signs in.
- Logout removes memory and disk state before a private route is shown.
- Cache older than 24 hours or with an old buster is rejected.
- Offline mode renders cached data and its timestamp within 2 seconds.
- Confirm, decline, vote, publish, and administrative actions cannot be submitted offline.
- No mutation is restored or executed after reconnection.
- Authenticated API responses do not appear in Service Worker Cache Storage.
