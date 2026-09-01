<!--
Sync Impact Report
- Version change: template (unratified) -> 1.0.0
- Modified principles:
  - Placeholder Principle 1 -> I. Server-Enforced Security
  - Placeholder Principle 2 -> II. Domain Integrity and Historical Preservation
  - Placeholder Principle 3 -> III. MVP Simplicity and Controlled Scope
  - Placeholder Principle 4 -> IV. Automated Quality Gates
  - Placeholder Principle 5 -> V. Resilience, Privacy, and Operability
- Added sections:
  - Product and Technical Constraints
  - Development Workflow and Delivery Gates
- Removed sections: none
- Follow-up TODOs: none
-->
# Meia Boca Juniors Constitution

## Core Principles

### I. Server-Enforced Security
Authorization and critical business rules MUST be enforced in PostgreSQL through RBAC, Row Level
Security, constraints, triggers, or transactional functions as appropriate. The client MUST NOT be
treated as a security boundary, and possession of a resource ID MUST NOT grant access. Administrative
and critical actions MUST record actor, timestamp, action, and affected resource in an audit log.
Secrets, service-role credentials, passwords, tokens, invitations, backups, and real player data MUST
NOT be committed to Git or exposed in the browser bundle. Administrative accounts MUST use TOTP 2FA.
Every database change affecting access MUST include explicit RLS review and automated authorization
tests. These rules are non-negotiable because the application processes private identity, attendance,
sporting, and role data.

### II. Domain Integrity and Historical Preservation
The database MUST be the final authority for domain invariants. Foreign keys, explicit delete
behavior, uniqueness constraints, validated status values, and transactions MUST prevent orphaned,
duplicate, partial, or impossible states. Multi-step operations such as match rescheduling,
attendance reset, and statistics consolidation MUST execute atomically. Athlete removal MUST use
soft deletion and anonymization when required; sporting history MUST remain intact and shirt numbers
MUST become reusable according to the approved rules. Critical calculations, deadlines, voting
eligibility, lineup eligibility, and official statistics MUST NOT depend exclusively on client-side
logic. This preserves trustworthy club records even under concurrent or direct API requests.

### III. MVP Simplicity and Controlled Scope
The MVP MUST remain a single-tenant, modular monolith dedicated to the Meia Boca Juniors and delivered
as a responsive, mobile-first React PWA; native Android/iOS applications and a shared multi-tenant
database are out of scope. The approved stack in `TECH_STACK.md` is binding. New infrastructure,
libraries, abstractions, feature flags, background services, or external integrations MUST have a
demonstrated MVP requirement and a simpler option comparison before adoption. Payments, billing,
transactional email, behavioral analytics, marketing, product AI, multiple languages, and SaaS
capabilities MUST NOT be implemented in this phase. White-Label readiness MUST be limited to
centralized visual and institutional configuration with independent multi-instance deployments.
This protects the R$ 0 incremental-cost target and keeps the solo learning project deliverable.

### IV. Automated Quality Gates
Every change MUST preserve strict TypeScript correctness and pass formatting, lint, typecheck,
automated tests, and production build in CI before reaching `main`. Critical journeys—authentication,
permissions/RLS, invitations, attendance, rescheduling, lineup publication, statistics consolidation,
voting, and administrative password reset—MUST have tests at the appropriate unit, integration, or
end-to-end level. Bug fixes MUST add a regression test whenever the failure can be reproduced
automatically. Pull Requests MUST receive a structured self-review assisted by Codex, validate the
Cloudflare preview when UI behavior changes, and satisfy the Definition of Done. Accessibility MUST
meet WCAG AA for contrast, focus, keyboard use, semantics, screen readers, and touch targets.

### V. Resilience, Privacy, and Operability
External-service failure MUST degrade gracefully: push and monitoring failures MUST NOT block core
club workflows. Offline support MUST remain read-only and restricted to the last known next match and
active lineup; offline writes MUST be disabled and MUST NOT be queued. Persisted queries MUST use an
explicit allowlist, versioned keys, expiration, minimal personal data, and mandatory purge on logout
or user change. Logs, Sentry events, and operational metrics MUST exclude unnecessary personal data
and all credentials. Supabase Free data MUST be backed up externally at least weekly and before
critical migrations, with encryption when personal data is present, retention of four verified backup
sets, failure alerts, and documented restore tests. Production operation MUST include an external
healthcheck and a reproducible recovery path.

## Product and Technical Constraints

- The user interface and functional documentation MUST use Brazilian Portuguese. Code, database
  objects, technical identifiers, and commits MUST use English and the naming conventions in
  `TECH_STACK.md`.
- The implementation MUST use TypeScript, React, Vite PWA, Supabase Free, Tailwind CSS, shadcn/ui,
  TanStack Query, Zustand, React Hook Form, Zod, React Router, Vitest, Testing Library, and Playwright
  as assigned in `TECH_STACK.md`. Third-party SDKs MUST remain behind adapters.
- TanStack Query MUST exclusively own remote/server state. Zustand MUST contain only client UI state;
  form values belong to the form layer and MUST NOT be duplicated in either store without a documented
  necessity.
- Production, staging, and local development MUST remain isolated. Staging and preview environments
  MUST use fictitious data and MUST NOT modify production records.
- The public GitHub repository MUST contain code, migrations, tests, and documentation only. Runtime
  secrets, local environment files, database exports, and real player data are prohibited.
- Dates MUST be stored in UTC and displayed in `pt-BR` using `America/Sao_Paulo`. User-facing status
  values and messages MUST come from centralized typed definitions.
- The source of truth for feature behavior is the approved feature specification. The latest explicit
  owner decision supersedes older briefing language when a conflict is documented; specifically,
  mobile access means a responsive browser-based PWA for this MVP.

## Development Workflow and Delivery Gates

1. Work MUST begin with an approved specification that defines user stories, acceptance criteria,
   permissions, failure states, and out-of-scope behavior.
2. The implementation plan MUST pass a Constitution Check before design artifacts or tasks are
   finalized. Any exception MUST include its rationale, risk, and rejected simpler alternative.
3. Tasks MUST be dependency-ordered and MUST explicitly cover database migrations, RLS policies,
   validation, tests, accessibility, observability, and documentation when applicable.
4. Database schemas MUST change only through versioned SQL migrations. A verified backup MUST complete
   before a critical production migration; backup failure MUST block that migration.
5. Development MUST occur on a feature or fix branch. A Pull Request with passing GitHub Actions and
   required review MUST precede merge to protected `main`; direct pushes are prohibited.
6. Deployment MUST preserve separation between web validation, Cloudflare production publication,
   and Supabase migration/Edge Function release. Production secrets MUST come only from the approved
   secret stores.
7. A feature is done only when its acceptance criteria pass, relevant automated tests pass, RLS and
   privacy impacts are reviewed, documentation is current, and the preview or production behavior is
   verified in proportion to risk.

## Governance

This constitution supersedes conflicting project practices, plans, and implementation convenience.
`TECH_STACK.md` and approved feature specifications are binding subordinate guides and MUST remain
consistent with it. Amendments require a written proposal describing the change, motivation, impact
on existing artifacts, migration needs, and any newly introduced complexity. The project owner must
approve every amendment before dependent planning or implementation proceeds.

Constitution versions follow semantic versioning: MAJOR for removal or incompatible redefinition of
governance principles; MINOR for a new principle, section, or materially expanded obligation; PATCH
for clarifications that do not change required behavior. Every amendment MUST update the Sync Impact
Report, version, and amendment date. Ratification date remains the date of first adoption.

Every specification, plan, task list, Pull Request, and release review MUST verify compliance with
the applicable principles. Deviations MUST be visible, narrowly scoped, approved by the project
owner, and accompanied by a remediation or migration plan. Unjustified complexity or a control that
cannot be verified MUST be rejected.

**Version**: 1.0.0 | **Ratified**: 2026-08-25 | **Last Amended**: 2026-08-25
