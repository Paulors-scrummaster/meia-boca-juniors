# Feature Specification: Post-MVP Modules Expansion (MBJ)

**Feature Branch**: `003-mbj-post-mvp-expansion`

**Created**: 2026-09-08

**Status**: READY FOR IMPLEMENTATION

**Input**: User description: "Post-MVP Modules Expansion (MBJ) — Financeiro/Mensalidades, Resenha/Churrasco, UX & Gamificação (Cards EA FC, troféus, Raio-X, notificações), Gestão Avançada de Jogos (Súmula Live com cronômetro e validação pós-jogo). Reutiliza atletas, papéis (ROLES), partidas (MATCHES) e presenças já estruturados no Supabase/MVP. Tema Dark Navy (#0A1325), cards azul (#111C35), acentos dourados (#E6B014), brasão oficial."

## Overview

This feature adds four independent management-and-engagement pillars on top of the existing MBJ MVP. Each pillar delivers value on its own and reuses the MVP's athlete, role, match, and attendance data:

1. **Financeiro & Mensalidades** — automatic monthly dues, manual charges, exemptions, discreet delinquency badges, manual payment settlement.
2. **Resenha / Churrasco Pós-Jogo** — social events independent of matches, with companion counts and automatic per-person cost split.
3. **UX & Gamificação** — premium MBJ collectible player cards (EA FC-inspired, own identity, no third-party marks; detailed + compact variants), automatic digital trophies, head-to-head "Raio-X" card on scheduled matches, a "Histórico & Conquistas" tab, and push notifications for weekly highlights and pre-match stats.
4. **Gestão Avançada de Jogos (Súmula Live)** — pre-match live-recording setup with a designated field recorder, a stopwatch interface with quick-action buttons (goal, assist, cards, substitution), an undo action, real-time broadcast to viewers, and a post-match review/consolidation screen that requires explicit technical-committee confirmation.

All new screens follow the Dark Navy theme (background `#0A1325`, cards `#111C35`, gold accents `#E6B014`) and use the official club crest in screens, cards, and report headers.

## Clarifications

### Session 2026-09-08

- Q: What charge states are needed beyond PENDING / PAID / OVERDUE for cancellations and reversed payments? → A: Add `CANCELLED` (directorate voids a charge; excluded from delinquency) and allow reverting `PAID` → `PENDING`/`OVERDUE`; every transition is audit-logged with actor, timestamp, and reason.
- Q: Are the weekly-highlight push notifications generated automatically from stats or composed by staff? → A: Automatic — system generates them from consolidated active-season stats using fixed deterministic rules (initial categories: top scorer, top assister, best goalkeeper of the week) and sends without staff approval this phase.
- Q: Is season a reused MVP concept or a new entity, and who starts a new season? → A: Authorized admin/technical staff explicitly open and close seasons, exactly one active at a time; activating a new season zeroes trophy counters and season-scoped stats while preserving all prior-season history and trophies. *(Refined later this session: implemented by extending the existing `public.seasons` table with start/end dates + open/closed status — not a new standalone entity.)*
- Q: What determines "played a match", "goalkeeper", and a Muralha clean sheet? → A: The finalized súmula is authoritative — "played" = listed in that match's confirmed lineup/substitutions; "goalkeeper" = athlete recorded in the goalkeeper position for the match; Muralha clean sheet = that keeper conceded 0 goals while on the field, and a mid-match goalkeeper substitution voids clean-sheet credit for both keepers.
- Q: Who can finalize/lock the súmula — the designated Field Recorder or committee only? → A: Technical-committee / admin users only. The Recorder can access the review screen and edit logged events, but cannot click "Confirmar e Finalizar Súmula" unless they also hold committee/admin permission.
- Q: How many companions may an athlete bring to a social event? → A: Maximum 20 companions per athlete per event; `guests_count` is constrained to the range 0..20. The "exact cap to be set in planning" wording is retired — the cap is decided.
- Q: Does the owner explicitly approve the Financial module's deviation from Constitution Principle III / TECH_STACK §14 ("no payments/billing this phase")? → A: **Yes — explicit owner approval granted on 2026-09-08**, scoped strictly to this feature: an internal club financial ledger (dues, charges, status, delinquency), with **no** payment gateway, **no** PIX, **no** card processing, **no** transactional email, **no** external billing integration, and R$ 0 incremental infrastructure cost. Rationale: the module is internal financial bookkeeping, not a payments platform. This is a first-time explicit approval recorded now; it was not pre-approved in any earlier session. *(Superseded 2026-09-08: Constitution amended to v1.1.0 with a permitted "Internal Financial Bookkeeping" boundary in Principle III — the Financial module is now compliant by amendment, not a deviation.)*
- Q: Is the season concept a brand-new standalone entity or an extension of the existing MVP `seasons` table? → A: Extend the existing `public.seasons` table — add start/end dates, an open/closed status, and admin open/close commands; keep `year` and `is_active`; exactly one active at a time. No parallel Season entity is created.
- Q: When a participant changes their companion count on an open social event, must other participants' screens update in real time or only on refresh? → A: Refresh-only — the per-person value is always correct when the event screen loads or is refetched; there is no live push to other viewers. No Supabase Realtime channel for social events.
- Q: What does súmula finalization actually refresh, given attribute cards are fully committee-entered? → A: It re-evaluates trophy triggers and refreshes the trophy gallery, season-progress, Raio-X, and leaderboard views. The EA FC attribute card is NOT recalculated — it has no consolidated-statistic input; its `overall` derives only from the six manually set values.
- Q: When is the pre-match statistics push sent? → A: Fired by the existing MVP match-reminder routine, ~24 h before kickoff — one push per upcoming match, carrying MBJ's key active-season stats and the head-to-head (Raio-X) record versus the upcoming opponent. No new scheduler is added. (Opponent season stats are not carried — the MVP tracks MBJ statistics only.)
- Q: Does finalizing a live súmula open the MVP "Craque do Jogo" voting round automatically, like manual consolidation? → A: Yes — live finalization reuses the existing consolidation path and opens the 24-hour MVP voting round automatically, identical to a manually consolidated match (same voting notification to the squad).
- Q: What is the visual reference and identity constraint for the US4 player attribute card? → A: The card is a **premium vertical collectible** inspired by EA FC / FIFA player cards but is an **original MBJ interpretation**. Repo-root files `exemplo card ea fifa.jpeg` and `exemplo card ea fifa 2.jpeg` are the primary visual reference (composition, hierarchy, framing, scale, photography, information layout) — reference only, never shipped, never used as the card background. The card MUST NOT reproduce any EA/FIFA logo, trademark, proprietary frame silhouette, or protected nomenclature; the frame and backdrop are recreated from project primitives (vector / CSS / tokens). This refinement is presentation-only: data model, overall formula (`round((pace+shooting+passing+dribbling+defending+physical)/6)`), the six manually-set attributes, RBAC, Season, trophies, súmula, and finance rules are unchanged.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Financial dues and manual settlement (Priority: P1)

The directorate (President / Financial role) manages the squad's monthly dues. The system generates a dues charge for every active athlete at the start of each month; the directorate can add one-off charges, adjust individual amounts, and grant exemptions. Each athlete sees a discreet "Pendente" or "Em Atraso" badge on their profile without losing access to matches. When payment is confirmed outside the app (e.g. PIX receipt), the directorate settles the charge manually and the badge clears.

**Why this priority**: Financial control of squad delinquency is the highest-value recurring management need and is fully independent of the other pillars.

**Independent Test**: Configure a default dues amount, mark athletes active, trigger the monthly generation routine, verify one charge per active athlete with the correct due date, then settle one charge manually and verify the badge clears.

**Acceptance Scenarios**:

1. **Given** it is the 1st of the month and 20 athletes have status ATIVO, **When** the monthly dues routine runs, **Then** 20 charges are created at the configured default amount, each with `due_date` set to the 10th of the same month and `status` PENDING, and each athlete sees a pending badge on their panel.
2. **Given** an athlete has a PENDING dues charge, **When** the President confirms receipt and clicks "Dar Baixa", **Then** the charge `status` becomes PAID, the settlement is recorded with actor and timestamp, and the pending badge is removed from the athlete's profile.
3. **Given** an athlete has an exemption for the current period, **When** the monthly dues routine runs, **Then** no dues charge is generated for that athlete.
4. **Given** a PENDING dues charge whose `due_date` has passed, **When** the daily delinquency check runs, **Then** the charge `status` becomes OVERDUE and the athlete's badge changes to "Em Atraso" while match access is unaffected.
5. **Given** the directorate needs an ad-hoc charge, **When** a Financial-role user creates a manual charge for an athlete with an amount, due date, and type, **Then** the charge appears in that athlete's financial list and the directorate's financial list.

---

### User Story 2 - Social event organization and cost split (Priority: P2)

The President creates a social event (Resenha / Churrasco) with its own date, time, and location, independent of any match. Athletes confirm or decline and enter how many companions they will bring. The system continuously recalculates the per-person cost as `total_cost` divided by the number of confirmed people (athletes + companions). When the directorate closes the event, the split is consolidated and stops changing.

**Why this priority**: High engagement value and financially sensitive (accurate split), but not required for the club's core operation.

**Independent Test**: Create an event with a total cost, have several athletes confirm with companion counts, verify the displayed per-person value equals `total_cost / total confirmed people`, change a companion count and verify recalculation, then close the event and verify the value is frozen.

**Acceptance Scenarios**:

1. **Given** the President creates "Churrasco da Vitória" with `total_cost` R$ 600,00, **When** 10 athletes confirm and 5 of them each declare +1 companion (15 people total), **Then** every confirmed athlete's screen shows R$ 40,00 per person.
2. **Given** the event is open and the per-person value is displayed, **When** an athlete changes their companion count, **Then** that athlete sees the recalculated per-person value immediately, and every other confirmed participant sees the updated value the next time their event screen loads or is refetched.
3. **Given** an open event with confirmations, **When** the directorate clicks "Fechar Evento & Consolidar Rateio", **Then** the per-person value is frozen at the last calculated amount and further confirmation/companion changes no longer affect it.
4. **Given** an event with zero confirmed people, **When** the per-person value would be calculated, **Then** the system shows the split as unavailable (no division by zero) rather than an error.

---

### User Story 3 - Live match recording with stopwatch and undo (Priority: P3)

Before a match, the technical committee marks it for live recording and designates a Field Recorder. During the match the Recorder uses a stopwatch screen with quick-action buttons to log goals, assists, yellow/red cards, and substitutions, each automatically stamped with the current match minute. A floating "Desfazer" button reverts the last action within 30 seconds without cluttering the history. Events are broadcast in near real time to athletes and viewers. When the match ends, the Recorder or a technical-committee member opens a review screen and adjusts any minute or assist author, but only a technical-committee / admin user can explicitly confirm to finalize the súmula and consolidate general statistics.

**Why this priority**: High engagement and a differentiator, but the club can operate without it and it depends on the existing matches data.

**Independent Test**: Mark a match for live recording, assign a Recorder, start the stopwatch, log a goal at minute 14, log a second goal by mistake, press "Desfazer" within 30 seconds, and verify only one goal at 14' remains and was broadcast. Then end the match, edit an assist author on the review screen, confirm finalization, and verify squad statistics reflect exactly the reviewed data.

**Acceptance Scenarios**:

1. **Given** the technical committee starts the stopwatch at the opening whistle (00:00), **When** the recorder clicks "Gol" for athlete #9 at minute 14 and then accidentally clicks "Gol" again, **Then** clicking "Desfazer" immediately removes the second goal and only one goal stamped 14' is broadcast to the squad app.
2. **Given** a live event was logged more than 30 seconds ago, **When** the recorder presses "Desfazer", **Then** the undo is not applied to that event and the recorder is told the undo window has passed.
3. **Given** a live event is logged, **When** the broadcast completes, **Then** the event appears on athlete/viewer screens within the real-time latency target.
4. **Given** the match is ended on the stopwatch, **When** the recorder opens the final review screen, **Then** all logged events are listed with editable minute and (where applicable) author/assist fields.
5. **Given** the review screen shows the logged events, **When** the technical committee clicks "Confirmar e Finalizar Súmula", **Then** the súmula is locked, general squad/championship statistics are updated atomically to match the reviewed data exactly, and stat-derived views (trophy gallery, season progress, Raio-X, leaderboards) reflect the new totals — the EA FC attribute card is unaffected.
6. **Given** a match is not marked for live recording, **When** its detail screen is opened, **Then** no stopwatch/recorder interface is offered.
7. **Given** the recording device loses connectivity mid-match, **When** the recorder keeps logging events, **Then** those events are stored on the device and, on reconnection, sync automatically with no duplicates, and "Confirmar e Finalizar Súmula" stays disabled until the buffer is empty.
8. **Given** a non-committee club member is designated as Field Recorder for a match, **When** the match is finalized, **Then** that member can no longer log events for it.
9. **Given** a non-committee Field Recorder is on the post-match review screen, **When** they attempt to finalize the súmula, **Then** the action is blocked and finalization remains available only to technical-committee / admin users (the Recorder may still edit logged events).

---

### User Story 4 - Attribute cards, trophies, Raio-X, and notifications (Priority: P4)

The technical committee edits each athlete's numeric attributes (pace, shooting, passing, dribbling, defending, physical) in the admin panel, and the system renders a premium MBJ collectible player card (EA FC-inspired, original MBJ identity — see FR-019a–h) with an overall rating. The system automatically awards digital trophies on the athlete's profile when match-statistic triggers are met. On a scheduled match's detail screen, a "Raio-X" card shows the head-to-head history versus that opponent (wins, draws, losses, goal difference). A dedicated "Histórico & Conquistas" menu tab shows the club's overall record and the trophy gallery. The system sends push notifications for weekly highlights and pre-match statistics.

**Why this priority**: Pure engagement/gamification layer; valuable for retention but the least operationally critical.

**Independent Test**: Edit an athlete's six attributes in the admin panel, verify the rendered card and overall value; register match statistics that meet a trophy trigger and verify the trophy appears on the profile and in the gallery; open a scheduled match against a previously played opponent and verify the Raio-X totals; trigger a weekly highlight and verify a push notification is delivered.

**Acceptance Scenarios**:

1. **Given** the technical committee sets an athlete's six attributes (each 1–99) in the admin panel, **When** the **detailed** card is rendered, **Then** it shows the six attributes as `RIT/FIN/PAS/CON/DEF/FÍS` with values, the `overall` = `round((pace+shooting+passing+dribbling+defending+physical)/6)` in large emphasis, the position abbreviation, the Brazil flag, the official MBJ crest, the athlete photo as the central hero element, and the athlete name centred in the lower region — all inside the premium gold frame over the dark sporting backdrop, with no EA/FIFA logo or trademark present.
1a. **Given** a screen listing many athletes (e.g. the roster grid), **When** it renders, **Then** each athlete appears as a **compact** card preserving the photo, `overall`, name, position, and the MBJ gold-on-navy identity, and the layout reflows cleanly on desktop, tablet, and mobile.
2. **Given** an athlete reaches 10 goals in the active season (or any other catalog trigger), **When** statistics are consolidated, **Then** the corresponding trophy — tagged with the active season — is added to the athlete's profile and appears in the "Histórico & Conquistas" gallery, without duplicates for that season.
2a. **Given** an athlete earned "Artilheiro" last season, **When** a new season starts and their goal counter restarts from zero, **Then** last season's "Artilheiro" trophy is still shown and they can earn "Artilheiro" again for the new season.
3. **Given** a match is scheduled against an opponent the club has faced before, **When** the match detail screen is opened, **Then** the Raio-X card shows total wins, draws, losses, and goal difference against that opponent.
4. **Given** a match is scheduled against a new opponent, **When** the match detail screen is opened, **Then** the Raio-X card indicates there is no prior history rather than showing zeros as if a match were played.
5. **Given** the "Histórico & Conquistas" tab is opened, **When** it loads, **Then** it shows the club's aggregate record and the full trophy gallery.
6. **Given** weekly highlights or pre-match stats are published, **When** the notification is sent, **Then** squad members with push enabled receive it; a push delivery failure does not block any core club workflow.

---

### Edge Cases

- **Accidental goal during live recording (E-01)**: A floating "Desfazer" button reverts the last action only within the first 30 seconds; after that the event must be corrected on the post-match review screen. Undone actions do not remain in the visible history.
- **Companion count changes after the split was calculated (E-02)**: The per-person value recalculates dynamically for every open event until the directorate clicks "Fechar Evento & Consolidar Rateio", after which it is frozen.
- **Loss of internet during field recording (E-03)**: The live-recording (súmula) screen is an **approved, narrowly scoped exception to constitution Principle V**. While offline, unsynced events of the *active match only* are stored locally on the device; on reconnection the app automatically syncs the pending events, applying idempotency / duplicate-event prevention and basic conflict handling during sync. Every other part of the app keeps following the "no offline writes" rule. The implementation plan MUST document this Principle V exception explicitly.
- **Monthly routine runs twice / re-runs for a period**: Dues generation must be idempotent per athlete per period — a second run in the same month must not create duplicate charges.
- **Athlete becomes inactive mid-month**: Existing charges for that athlete remain as-is (still owed unless the directorate cancels or exempts them); no new charges are generated while inactive.
- **Athlete confirms a social event then declines after closing**: Post-closing status changes are recorded but do not change the consolidated split.
- **Two recorders / concurrent edits on the same live match**: Only the single designated Field Recorder can log events; the system prevents a second concurrent recorder for the same match.
- **Overall rating when not all attributes are set**: The card shows an incomplete state rather than a misleading rating until all six attributes exist.
- **Raio-X when only future (unplayed) matches exist against an opponent**: Treated as no history.
- **Trophy trigger met retroactively after a súmula edit**: Consolidation re-evaluates triggers and may award a trophy that a correction newly qualifies for. Awarded trophies are **permanent history** — they are never duplicated and never revoked once awarded, even if a later edit removes the statistic that earned it. Awards are strictly system-driven; there is no manual grant or revoke in this phase.
- **New season starts while an athlete has trophy progress**: Season-scoped trigger counters (goals, assists, matches, clean sheets) reset to zero for the new season; trophies already earned in prior seasons remain in the athlete's profile/gallery and the same trophy type can be earned again in the new season.
- **Live-recording device goes offline then the match ends before reconnection**: The súmula cannot be finalized until all locally buffered events for that match have synced; the review screen shows a "pending sync" state and blocks "Confirmar e Finalizar Súmula" until sync completes.

## Requirements *(mandatory)*

### Functional Requirements

#### Module 1 — Financeiro & Mensalidades

- **FR-001**: System MUST generate, on the 1st of each month, one dues charge for every athlete with status ATIVO, at the configured default dues amount, with `due_date` set to the 10th of that month, `status` PENDING, and `type` MONTHLY_AUTOMATIC.
- **FR-002**: Monthly dues generation MUST be idempotent per athlete per month — re-running it MUST NOT create duplicate charges for a period already generated.
- **FR-003**: System MUST let Directorate users (President / Financial role) create one-off manual charges for an athlete, specifying amount, due date, and type (MANUAL_OVERRIDE or EVENT_FEE).
- **FR-004**: System MUST let Directorate users adjust the amount of an individual dues charge and grant per-athlete exemptions that cause the monthly routine to skip that athlete for the exempted period(s).
- **FR-005**: System MUST display a discreet delinquency badge ("Pendente" for PENDING, "Em Atraso" for OVERDUE) on the athlete's profile and in the directorate's financial list.
- **FR-006**: Delinquency status MUST NOT block an athlete's access to matches, lineups, voting, or any core club workflow.
- **FR-007**: System MUST transition a PENDING charge to OVERDUE automatically once its `due_date` has passed (evaluated at least once per day).
- **FR-008**: System MUST let Directorate users settle a charge manually ("Dar Baixa"), setting `status` to PAID after off-app receipt confirmation, and MUST record the settling actor, timestamp, and affected charge in the audit log.
- **FR-009**: System MUST let a Directorate user configure the club-wide default monthly dues amount, applied to future generations only.
- **FR-010**: Only Directorate roles (President / Financial — the President role covers this in this phase; no FINANCE role is added) MUST be able to create, edit, exempt, cancel, settle, or reverse-settle charges; other users MUST only view their own charges and badge.
- **FR-010a**: System MUST let a Directorate user set a charge to `CANCELLED` (voiding it); a `CANCELLED` charge MUST be excluded from delinquency badges and financial totals.
- **FR-010b**: System MUST let a Directorate user reverse a settlement made in error, moving a `PAID` charge back to `PENDING` (or `OVERDUE` if its `due_date` has already passed).
- **FR-010c**: Every charge status transition (including settle, reverse-settle, and cancel) MUST be recorded in the audit log with actor, timestamp, and a reason entered by the user.

#### Module 2 — Resenha / Churrasco Pós-Jogo

- **FR-011**: System MUST let authorized organizers create social events with a title, date/time, location, and total cost, independent of any match record.
- **FR-012**: System MUST let an athlete set their event presence to CONFIRMED or DECLINED and enter an integer companion count between 0 and 20 inclusive.
- **FR-013**: System MUST compute the per-person cost as `total_cost` divided by the total number of confirmed people (confirmed athletes + their companions) and display the same value to every confirmed participant.
- **FR-014**: System MUST recompute the per-person cost from current confirmations whenever the open event screen loads or is refetched, so the value shown is always correct for the data at load time. Real-time push of the updated value to other participants' already-open screens is NOT required (no Supabase Realtime channel for social events); the acting participant sees their own change reflected immediately.
- **FR-015**: System MUST let the directorate close an event ("Fechar Evento & Consolidar Rateio"), after which the per-person cost is frozen and subsequent presence/companion changes do not alter it.
- **FR-016**: System MUST handle an event with zero confirmed people by presenting the split as unavailable rather than producing an error or dividing by zero.
- **FR-017**: For this phase the social-event split is **display-only**: closing an event freezes and shows each participant's share but does NOT automatically create EVENT_FEE charges in the financial ledger. A Directorate user MAY still create a manual EVENT_FEE charge (FR-003) if they choose.

#### Module 3 — UX & Gamificação

- **FR-018**: System MUST let the technical committee edit, in the admin panel, each athlete's six attributes — pace, shooting, passing, dribbling, defending, physical — as integers from 1 to 99.
- **FR-019**: System MUST render each athlete's attributes as a **premium vertical collectible card** in the MBJ visual language — an original interpretation inspired by EA FC / FIFA player cards that MUST NOT reproduce any EA/FIFA logo, trademark, proprietary frame silhouette, or protected nomenclature. The `overall` shown is exactly `round((pace + shooting + passing + dribbling + defending + physical) / 6)` over the six manually-set values (FR-018); the card never recalculates attributes (FR-035).
- **FR-019a** (format & frame): The card MUST use a portrait collectible format at a proportion close to the references (≈ 2:3), with an elaborate outer gold frame, an ornamental curved/pointed top, and a premium finish. The frame MUST be drawn from project primitives (vector / CSS), never by embedding the reference JPEGs.
- **FR-019b** (palette): The card MUST use black / very dark navy as the base and gold as the primary accent, consistent with the app's existing Dark Navy + gold theme tokens; text and dividing lines MUST be gold. No colour outside the token system.
- **FR-019c** (info rail): The card MUST show, in a top/left information column: the `overall` in large emphasis; the athlete's position abbreviation directly below it; the Brazil flag; and the official MBJ crest. The position abbreviation is derived on the client from the athlete's `primary_position` (exposed by the `athlete_card` read) via a documented pt-BR map in `attributeCard.constants.ts` (e.g. Goleiro→GOL, Zagueiro→ZAG, Lateral→LAT, Volante→VOL, Meia→MEI, Atacante→ATA), falling back to the first three uppercased characters of `primary_position` when unmapped. The Brazil flag is shown for every athlete (the MVP has no nationality field and none is added).
- **FR-019d** (player photo): The athlete photo MUST be the card's primary visual element, occupying the largest central area and visually overlapping the frame/background effects. The component MUST accept a transparent-background cutout when such an asset exists and MUST degrade gracefully to the existing athlete avatar (`athletes.photo_path`) and then to a neutral silhouette placeholder. Per-athlete cutout assets are a future enhancement; this phase reuses the existing avatar — no data-model or storage change.
- **FR-019e** (background): The card background MUST evoke a dark sporting environment with golden lighting — subtle particles / glow / graphic rays and an optional low-opacity MBJ crest watermark — composed from project primitives (gradients, SVG, CSS, at most one lightweight project-authored texture) and kept visually uncluttered. The reference JPEGs MUST NOT be used as the background.
- **FR-019f** (nameplate): The athlete's name MUST appear large and centred in the lower region in a strong sporty typeface with high legibility, framed by thin gold rules.
- **FR-019g** (attributes strip): The card base MUST display the six attributes as equal columns separated by thin gold dividers, each showing an abbreviation over its numeric value, using the fixed mapping `RIT`=pace, `FIN`=shooting, `PAS`=passing, `CON`=dribbling, `DEF`=defending, `FÍS`=physical, in that order (matching the references).
- **FR-019h** (variants & responsiveness): The card MUST render correctly on desktop, tablet, and mobile and MUST provide at least two variants — a **detailed** variant (full frame, backdrop, info rail, hero photo, nameplate, attribute strip) and a **compact** variant for grids/listings of many athletes that preserves the photo, `overall`, name, position, and the MBJ gold-on-navy identity. Interior typography and spacing MUST scale fluidly with the card size.
- **FR-020**: System MUST show an explicit incomplete state on both card variants when any of the six attributes is not yet set — the attribute strip shows a placeholder ("—") per unset stat and no `overall` number is computed or shown.
- **FR-021**: System MUST automatically award digital trophies from a **fixed initial catalog** (no admin CRUD or generic configurable engine in this phase) when a trigger is met, evaluated at statistics consolidation, with no duplicate awards of the same trophy type within the same season. The initial catalog is:
  - **Artilheiro** — score 10 goals in the active season.
  - **Garçom** — record 10 assists in the active season.
  - **Hat-trick** — score 3 goals in a single match.
  - **Veterano** — play 10 matches in the active season, where "played" means being listed in that match's confirmed lineup or substitutions on the finalized súmula.
  - **Muralha** — as the match goalkeeper (the athlete recorded in the goalkeeper position on the finalized súmula), reach 5 clean sheets in the active season; a clean sheet requires 0 goals conceded while that keeper was on the field, and any mid-match goalkeeper substitution voids clean-sheet credit for both keepers in that match.
- **FR-021a**: All trophy triggers and their counters MUST be scoped to the **active season**, and the same trophy type CAN be earned again in a later season. (Season lifecycle and the zeroing of counters on a new season are specified in FR-021d; gallery retention of prior-season trophies in FR-021b.)
- **FR-021b**: Each awarded trophy MUST be associated with the season in which it was earned, and the athlete profile / "Histórico & Conquistas" gallery MUST preserve trophies from all past seasons.
- **FR-021c**: The trophy architecture MAY allow future catalog expansion, but this phase MUST NOT ship an administrative CRUD for trophy definitions nor a generic configurable trigger engine.
- **FR-021d**: System MUST extend the existing MVP `seasons` table with a start date, end date, and an open/closed status, and let authorized admin / technical staff explicitly open and close seasons, enforcing exactly one active season at a time (retaining the existing `year` and `is_active` fields). No parallel Season entity is created. Activating a new season MUST start trophy counters and season-scoped statistics from zero for that season while preserving all prior-season history and trophies.
- **FR-022**: System MUST display a "Raio-X" card on a scheduled match's detail screen showing wins, draws, losses, and goal difference against that opponent, based on previously played matches only.
- **FR-023**: System MUST indicate "no prior history" on the Raio-X card when the club has no completed match against the opponent, rather than showing zeroed totals.
- **FR-024**: System MUST provide a dedicated menu tab "Histórico & Conquistas" showing the club's aggregate record and the full trophy gallery.
- **FR-025**: System MUST send push notifications for weekly highlights and pre-match statistics to squad members who have push enabled. The pre-match statistics push MUST be fired by the existing MVP match-reminder routine approximately 24 hours before kickoff — one push per upcoming match, carrying MBJ's key active-season stats (top scorers/assisters and the club season record, from `season_scoring_leaders` / `club_all_time_record`) and the head-to-head (Raio-X) record versus the upcoming opponent — with no new scheduler introduced. Opponent-side season statistics are out of scope (the MVP tracks MBJ statistics only).
- **FR-025a**: The weekly highlight content MUST be generated automatically by the system from consolidated active-season statistics using fixed, deterministic rules — initial categories: top scorer of the week, top assister of the week, best goalkeeper of the week (fewest goals conceded / clean sheets among keepers who played). It MUST be generated and sent on a fixed weekly schedule with no staff composition or approval step in this phase.
- **FR-025b**: When a highlight category has no qualifying data for the week (e.g. no matches played, or a tie with no defined tiebreak), that category MUST be omitted rather than sent empty or blocking the other categories.
- **FR-026**: A push notification or highlight-generation failure MUST NOT block any core club workflow (graceful degradation).
- **FR-027**: Only the technical committee / admin roles MUST be able to edit attributes. Trophy awarding MUST be strictly system-driven: there is NO manual grant and NO manual or automatic revoke in this phase — once awarded, a trophy is permanent history.

#### Module 4 — Gestão Avançada de Jogos (Súmula Live)

- **FR-028**: System MUST let the technical committee mark a match, before kickoff, as live-recorded and designate exactly one user as Field Recorder for that match. **Any authenticated club member** can be designated; the designation itself is restricted to technical-committee / admin users.
- **FR-028a**: The Field Recorder designation is a **per-match authorization**, not a new global RBAC role. The designated user receives only the permissions needed to log súmula events for that one match.
- **FR-028b**: The Field Recorder authorization MUST cease automatically when the match is finalized or cancelled, or when a different user is designated as Recorder for that match.
- **FR-029**: System MUST provide a stopwatch interface, for live-recorded matches only, with quick-action buttons to log GOAL, ASSIST, YELLOW_CARD, RED_CARD, and SUBSTITUTION, each automatically stamped with the current match minute and the selected athlete (and target athlete for assist/substitution).
- **FR-030**: System MUST provide a floating "Desfazer Último Evento" action that reverts the most recent logged event only within 30 seconds of logging it, removing it from the visible history; after 30 seconds the event MUST be corrected only via the post-match review screen.
- **FR-031**: System MUST broadcast each logged (and each undone) live event to athlete/viewer screens in near real time.
- **FR-032**: System MUST prevent more than one active Field Recorder from logging events for the same match concurrently.
- **FR-033**: System MUST present a post-match review screen listing every logged event with editable minute and, where applicable, author / assist-author fields. The designated Field Recorder MAY access this screen and edit logged events; other non-committee members MUST NOT.
- **FR-034**: System MUST require an explicit "Confirmar e Finalizar Súmula" confirmation to end the match, after which the súmula is locked and general squad/championship statistics are consolidated atomically to match the reviewed data exactly. Only technical-committee / admin users MAY finalize and lock the súmula; a Field Recorder without committee/admin permission MUST NOT be able to finalize, even though they can edit events on the review screen.
- **FR-035**: Súmula consolidation MUST trigger re-evaluation of trophy triggers and refresh of all views derived from consolidated statistics — the trophy gallery, season-progress indicators, the head-to-head "Raio-X", and any leaderboards. The attribute card MUST NOT be recalculated: it has no consolidated-statistic input, and its `overall` derives only from the six manually set attribute values (formula in Assumptions).
- **FR-035a**: The finalized súmula MUST capture, for the match, the confirmed participant list (starting lineup + substitutions, reusing the MVP lineup data) and which athlete held the goalkeeper position, so that "matches played", "goalkeeper", and clean-sheet determinations are derivable from it. A mid-match goalkeeper substitution MUST be identifiable so clean-sheet credit can be voided for that match.
- **FR-035b**: Finalizing a live súmula MUST reuse the existing MVP consolidation path and therefore MUST open the 24-hour MVP "Craque do Jogo" voting round automatically and notify the squad, identical to a manually consolidated match.
- **FR-036**: A live event log and its broadcast MUST record actor (Field Recorder) and timestamp for audit purposes.
- **FR-037**: On connectivity loss, the live-recording screen MUST store unsynced events of the active match locally on the device and MUST auto-sync them when connectivity returns. This is an explicit, narrowly scoped exception to constitution Principle V that applies ONLY to this screen and ONLY to the active match's not-yet-synced events; the plan MUST document the exception.
- **FR-037a**: Offline-buffered event sync MUST be idempotent — a given logged event (including its undo) MUST NOT be duplicated in consolidated data if sync retries, and the system MUST apply basic conflict handling when buffered events arrive out of order or after a competing change.
- **FR-037b**: "Confirmar e Finalizar Súmula" MUST be blocked while any locally buffered event for that match is still unsynced; the review screen MUST show a pending-sync state until the buffer is empty.

#### Cross-cutting

- **FR-038**: All new modules MUST reuse the existing MVP data for athletes, roles (ROLES), matches (MATCHES), and attendance rather than duplicating those entities.
- **FR-039**: All authorization for the new modules MUST be enforced server-side by role, consistent with the existing MVP permission model; possession of a record ID MUST NOT grant access.
- **FR-040**: All new user-facing screens, cards, and report headers MUST use the Dark Navy visual theme and the official club crest, and MUST meet the project's accessibility bar (contrast, focus, keyboard, touch targets).
- **FR-041**: All new user-facing text MUST be Brazilian Portuguese; all monetary values MUST be shown in `pt-BR` currency format and all dates in `America/São Paulo`.

### Key Entities *(include if feature involves data)*

- **Charge (Subscription / Cobrança)** *(table: `athlete_charges`)*: A single amount owed by one athlete. Attributes: athlete reference, amount, due date, status (PENDING, PAID, OVERDUE, CANCELLED), type (MONTHLY_AUTOMATIC, MANUAL_OVERRIDE, EVENT_FEE), created timestamp, and settlement record (who settled it and when) when PAID. Allowed transitions: PENDING↔OVERDUE (automatic by due date), PENDING/OVERDUE→PAID (manual settle), PAID→PENDING/OVERDUE (manual reverse-settle), any non-final state→CANCELLED (manual void). CANCELLED charges are excluded from delinquency badges and totals. Every transition carries an audit entry (actor, timestamp, reason). Related to Athlete (MVP) and, for EVENT_FEE, to a Social Event.
- **Dues Configuration** *(tables: `dues_settings` singleton + `dues_exemptions`)*: Club-wide default monthly dues amount and the set of active per-athlete exemptions (athlete reference + exempted period). Used by the monthly generation routine.
- **Social Event (Churrasco / Resenha)** *(table: `social_events`)*: A club social gathering independent of matches. Attributes: title, event date/time, location, total cost, calculated per-person cost, and open/closed (consolidated) state. Related to many Event Presence records.
- **Event Presence** *(table: `social_event_presences`)*: One athlete's participation in a social event. Attributes: event reference, athlete reference, status (CONFIRMED, DECLINED), companion count (integer 0..20). Contributes `1 + companion count` people to the split when CONFIRMED.
- **Athlete Card Attributes** *(table: `athlete_card_attributes`)*: The six numeric skill ratings (pace, shooting, passing, dribbling, defending, physical), each 1–99, plus a derived overall rating, for one athlete. Related one-to-one to Athlete (MVP).
- **Season**: The existing MVP `seasons` table, extended (not replaced) with a start date, end date, and an open/closed status alongside its current `year` and `is_active` fields. Exactly one season is active at a time. Authorized admin / technical staff explicitly open and close seasons. Activating a new season causes trophy counters and season-scoped statistics to start from zero for that season; all historical data and trophies from prior seasons are preserved. Related to Trophy, and referenced by trophy-trigger and weekly-highlight calculations.
- **Trophy (Digital Achievement)** *(table: `athlete_trophies`)*: A recognition awarded to an athlete. Attributes: trophy type (from the fixed catalog: Artilheiro, Garçom, Hat-trick, Veterano, Muralha), the season it was earned in, awarded-at timestamp, and the triggering statistic context. Uniqueness: one award per athlete per trophy type **per season**. Permanent once awarded (never revoked). Related to Athlete (MVP) and Season.
- **Trophy Definition** *(table: `trophy_catalog`, seeded)*: The fixed initial catalog of five trophies and each one's season-scoped statistic trigger (see FR-021). Not user-editable in this phase.
- **Head-to-Head Record (Raio-X)** *(view: `head_to_head_record`)*: A derived view, not stored — aggregate wins, draws, losses, and goal difference of the club against a given opponent, computed from completed matches in the MVP MATCHES data.
- **Derived read views (not stored)**: `club_all_time_record` (club aggregate W-D-L + goal difference for the "Histórico & Conquistas" tab), `season_scoring_leaders` (per-season goals/assists/appearances per athlete — feeds weekly/pre-match highlights and trophy progress), `season_trophy_progress` (current count vs. threshold per trophy per athlete), `athlete_card` (per-athlete card payload: six attributes, `overall`, incomplete flag, `primary_position`, shirt name/number, photo path), `athlete_trophy_gallery` (all-seasons trophy list per athlete).
- **Live Match Event** *(table: `live_match_events`)*: One timestamped occurrence during a live-recorded match. Attributes: match reference (MVP), minute, event type (GOAL, ASSIST, YELLOW_CARD, RED_CARD, SUBSTITUTION), athlete reference, optional target athlete reference (assist provider / substituted player), recorder (actor), logged-at timestamp, undone flag / undo window, and a client-generated identifier used for idempotent offline sync. Related to Match (MVP) and Athlete (MVP).
- **Live Match Setup** *(table: `live_match_setups`)*: Per-match configuration marking it live-recorded, naming the single designated Field Recorder, and carrying the per-match Recorder authorization (granted by a technical-committee user; auto-revoked on finalize/cancel or re-designation). Tracks the súmula lifecycle state (recording, in review, finalized/locked) and whether any offline-buffered events are still pending sync.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the 1st of the month, 100% of active athletes receive their automatic dues charge in a single batch run, with zero missed athletes and zero duplicates.
- **SC-002**: For any closed social event, the sum of consolidated per-person shares equals the event's total cost with a difference of R$ 0,00.
- **SC-003**: A live event logged by the Field Recorder appears on athlete/viewer screens in under 2 seconds in at least 95% of cases.
- **SC-004**: After a technical-committee post-match review and finalization, there is 0% divergence between the reviewed súmula and the data stored in general squad/championship statistics.
- **SC-005**: An accidental duplicate live event undone within 30 seconds never reaches consolidated statistics and is not visible in the final súmula history.
- **SC-006**: Delinquency badges never prevent an athlete from entering a match, lineup, or vote — verified across all delinquency states.
- **SC-007**: A push-notification outage during a test does not block dues generation, event creation, live recording, or súmula finalization.
- **SC-008**: The directorate can create an event and see a correct per-person split for a 15-person scenario (R$ 600,00 → R$ 40,00) without manual calculation.
- **SC-009**: Every attribute-card render for an athlete with all six attributes set shows an overall rating consistent with the defined derivation, and an incomplete state otherwise.
- **SC-010**: For a scheduled match against a previously faced opponent, the Raio-X totals match an independent count of completed matches against that opponent.
- **SC-011**: Each of the five catalog trophies is awarded exactly once per athlete per season when its season-scoped trigger is met, and starting a new season lets the same athlete earn the same trophy type again while all prior-season trophies remain visible in the gallery.
- **SC-012**: Events logged on the live-recording screen while the device is offline are all present and non-duplicated in the consolidated súmula after reconnection, and finalization is blocked until every buffered event has synced.
- **SC-013**: A designated Field Recorder can log events only for the assigned match, and loses that ability immediately once the match is finalized, cancelled, or reassigned.
- **SC-014**: Running the weekly-highlight generation twice over the same consolidated week's data produces the identical set of highlight categories and named athletes (fully deterministic).
- **SC-015**: A charge set to CANCELLED never contributes to a delinquency badge or a financial total, and reversing a mistaken settlement restores the charge to the status it would hold given its due date.

## Assumptions

- The MVP already exposes stable, server-enforced concepts for Athlete (with an ATIVO/active status), Roles/permissions, Matches (with completed results and opponent identity), and Attendance, and these can be referenced by the new modules without schema duplication.
- "Directorate" maps to existing President and/or a Financial role in the MVP role model; if no distinct Financial role exists, the President role covers Module 1 actions until a Financial role is added.
- The monthly dues routine runs as a scheduled server-side job at the start of each month in `America/São Paulo` time; a manual "run now / re-run" control for a given period is available to the directorate and is idempotent.
- OVERDUE transition is performed by a daily scheduled check; there is no grace period beyond `due_date` unless the directorate adjusts the charge.
- Exemptions are period-scoped (per month) and set by the directorate on the athlete; an "indefinite" exemption is modeled as exemption applied every period until removed.
- Social event creation is limited to the directorate / an organizer role; `guests_count` is capped at 20 companions per athlete per event (range 0..20).
- Payment processing is out of scope: there is no payment gateway, PIX integration, card processing, external billing integration, or transactional email. All settlement is manual after off-app confirmation, consistent with keeping incremental cost at R$ 0. The Financial module is an internal ledger only. It was initially treated as an owner-approved deviation from Constitution Principle III / TECH_STACK §14 (2026-09-08); that deviation was then **resolved by the Constitution v1.1.0 amendment** (2026-09-08), which added an explicit permitted "Internal Financial Bookkeeping" boundary to Principle III — the module is now compliant, not a deviation. `TECH_STACK.md` §14 mirrors this boundary.
- "Viewers" of live matches are authenticated club members (athletes and other members); a public/unauthenticated spectator view is out of scope for this phase.
- The existing MVP `seasons` table is extended (start date, end date, open/closed status) rather than replaced; admin / technical staff open and close seasons with exactly one active at a time, and the season is the scope for all trophy triggers, season-scoped statistics, and weekly highlights.
- The Field Recorder is authorized per match (not via a new global role); a technical-committee/admin user makes the designation, and the authorization is revoked automatically on match finalize/cancel or re-designation.
- The offline buffering of live-recording events is a documented, narrowly scoped exception to constitution Principle V, limited to the súmula live screen and the active match's unsynced events; the implementation plan must record this exception with its rationale and rejected simpler alternative per the constitution's governance rules.
- Push notifications reuse the MVP's existing push mechanism and per-user push preferences; no new notification provider is introduced.
- The overall rating for attribute cards is `round((pace + shooting + passing + dribbling + defending + physical) / 6)` — the rounded arithmetic mean of the six manually-set attributes. It is display-only, does not feed lineup eligibility or voting, and is not recalculated by súmula consolidation.
- The player-card visual refinement is presentation-only. Reference images `exemplo card ea fifa.jpeg` / `exemplo card ea fifa 2.jpeg` stay in the repo root as visual reference and are never bundled or shipped; the card frame and backdrop are recreated from project primitives. A single self-hosted sporty display typeface (SIL OFL-licensed) is added for the nameplate/overall, exposed as a `--font-display` token; no external font provider or new npm runtime dependency is introduced.
- The card uses the existing athlete avatar (`athletes.photo_path`) as its photo source in this phase; a dedicated transparent-background cutout per athlete is a future enhancement and would not change the data model (the component already supports a cutout slot with a fallback chain).
- Every athlete card renders the Brazil flag; the MVP has no nationality field and none is added. The `athlete_card` read is extended to expose the athlete's `primary_position` (existing free-text field) so the client can derive the position abbreviation — no data-model change.
- Real-time broadcast of live events reuses the existing Supabase real-time capability already available to the project; no new infrastructure is added.
- The Dark Navy theme tokens (`#0A1325`, `#111C35`, `#E6B014`) and the official crest asset are added to the existing centralized visual configuration rather than hard-coded per screen.
- All new tables, RLS policies, and scheduled jobs are delivered as versioned SQL migrations with authorization tests, per the project constitution.

## Dependencies

- Existing MVP modules: Athlete management (with active status), Role/permission model, Match management (with results and opponent data), Attendance.
- Existing MVP infrastructure: Supabase (PostgreSQL, RLS, scheduled jobs, real-time), the project's push-notification mechanism, the centralized visual/theme configuration.
- Owner-approved exception to constitution Principle V for the súmula live-recording screen's offline event buffering — the **only** active constitutional deviation. `plan.md` Complexity Tracking documents it as a narrowly scoped deviation with rationale, rejected alternative, and a formal remediation/migration plan (containment invariants, review triggers, removal path).
- An extension of the existing MVP `seasons` table (adds start date, end date, open/closed status; admin-controlled open/close, one active at a time) to scope trophy triggers, season statistics, and weekly highlights.
