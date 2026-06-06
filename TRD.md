# Technical Requirement Document
## Time-Off Microservice — Frontend System

**Version:** 1.0  
**Date:** 2026-06-05  
**Stack:** Next.js 16.2.7 (App Router) · React 19 · TanStack Query v5 · Zustand v5 · TypeScript · Tailwind CSS v4 · MSW v2

---

## Table of Contents

1. [Overview & Scope](#1-overview--scope)
2. [System Context](#2-system-context)
3. [User Roles & Core Flows](#3-user-roles--core-flows)
4. [Architecture Overview](#4-architecture-overview)
5. [Component Tree Architecture](#5-component-tree-architecture)
6. [State Management Approach](#6-state-management-approach)
7. [Data Fetching Strategy](#7-data-fetching-strategy)
8. [Cache Strategy](#8-cache-strategy)
9. [Optimistic vs Pessimistic Update Strategy](#9-optimistic-vs-pessimistic-update-strategy)
10. [Cache Invalidation Strategy](#10-cache-invalidation-strategy)
11. [Reconciliation Strategy for Stale Balances](#11-reconciliation-strategy-for-stale-balances)
12. [Silent Failures & Delayed Contradictions](#12-silent-failures--delayed-contradictions)
13. [Batch vs Real-Time Endpoint Strategy](#13-batch-vs-real-time-endpoint-strategy)
14. [Error Handling UX Strategy](#14-error-handling-ux-strategy)
15. [Testing Strategy Overview](#15-testing-strategy-overview)
16. [Trade-offs](#16-trade-offs)
17. [Risks](#17-risks)
18. [Appendix — Diagrams](#18-appendix--diagrams)

---

## 1. Overview & Scope

This document specifies the frontend architecture for a Time-Off Microservice. The system enables employees to request leave and managers to approve or reject those requests, while treating an external HCM (Human Capital Management) system as the authoritative source of truth for balances, entitlements, and employee records.

### In Scope

- Employee-facing leave request and history UI
- Manager-facing approval, team calendar, and team balance UI
- BFF (Backend for Frontend) layer via Next.js Route Handlers
- Client-side caching, invalidation, and reconciliation logic
- Error and failure surface UX

### Out of Scope

- HCM backend implementation
- Push notification infrastructure
- Payroll integration
- Mobile native apps

---

## 2. System Context

```
┌────────────────────────────────────────────────────────────────────┐
│                          Browser Client                            │
│                                                                     │
│   Employee UI              Manager UI                              │
│   ─ Request leave          ─ Approve / Reject                      │
│   ─ View balance           ─ Team calendar                         │
│   ─ Request history        ─ Team balances                         │
└─────────────────────┬───────────────────────────────────────────────┘
                      │  HTTP / React Query / Zustand
                      ▼
┌────────────────────────────────────────────────────────────────────┐
│                   Next.js App (BFF Layer)                          │
│                                                                     │
│   Route Handlers  (/api/*)                                         │
│   Server Components (RSC)                                          │
│   Server Actions (mutations)                                       │
│   Next.js Server Cache (use cache / revalidateTag)                 │
└──────────────┬────────────────────────────┬────────────────────────┘
               │ REST / GraphQL              │ Webhooks / Polling
               ▼                            ▼
┌─────────────────────────┐    ┌────────────────────────────────────┐
│   Time-Off Service DB   │    │        HCM (Source of Truth)       │
│   (requests, approvals, │    │   ─ Leave balances                 │
│    audit log)           │    │   ─ Entitlements                   │
└─────────────────────────┘    │   ─ Employee records               │
                               │   ─ Accrual schedules              │
                               └────────────────────────────────────┘
```

**Critical constraint:** The HCM system is authoritative. The Time-Off service never stores canonical balances — it only stores request records. All balance reads flow through HCM. This creates the core tension between freshness and performance that every architectural decision in this document addresses.

---

## 3. User Roles & Core Flows

### 3.1 Employee Flow

```
Employee lands on /dashboard
  │
  ├─► Sees leave balance (from HCM, via BFF cache)
  ├─► Sees pending/approved/rejected requests (from Time-Off DB)
  │
  └─► Submits new request
        │
        ├─► Frontend validates: dates, minimum notice, balance coverage
        ├─► POST /api/requests → Time-Off service → HCM balance check
        │
        ├─[HCM rejects immediately]── Error toast → No state change
        ├─[HCM accepts immediately]── Pessimistic update → Show "Pending"
        └─[HCM accepts, async contradiction later]── See §12
```

### 3.2 Manager Flow

```
Manager lands on /manager/dashboard
  │
  ├─► Sees team pending requests (from Time-Off DB)
  ├─► Sees team leave calendar (merged from requests + HCM schedules)
  ├─► Sees per-employee balances (from HCM, batch endpoint)
  │
  └─► Approves / Rejects a request
        │
        ├─► PATCH /api/requests/:id → Time-Off service → HCM update
        ├─[Success]── Pessimistic update → move request to Approved/Rejected
        └─[Failure]── Revert UI, error toast
```

---

## 4. Architecture Overview

### 4.1 Rendering Model

Next.js 16 App Router with React Server Components as default. The project uses the **previous caching model** (no `cacheComponents: true` flag) until explicitly opted in — meaning `fetch` is uncached by default, and opt-in caching is done via `{ cache: 'force-cache' }`, `unstable_cache`, or route segment `revalidate`.

| Layer | What runs there | Why |
|---|---|---|
| Server Components | Initial page shell, layout data, role detection | Zero JS shipped to client for static structure |
| Client Components | Interactive forms, modals, optimistic state | Need `useState`, event handlers |
| Route Handlers `/api/*` | Proxy to HCM and Time-Off service | Hide credentials, normalize responses, add server-side caching |
| Server Actions | Form mutations (submit request, approve, reject) | Co-located with forms, automatic CSRF protection |

### 4.2 Role-Based Routing

```
app/
├── (auth)/
│   └── login/
├── (employee)/
│   ├── layout.tsx         ← enforces employee role from session
│   ├── dashboard/page.tsx
│   ├── request/page.tsx
│   └── history/page.tsx
├── (manager)/
│   ├── layout.tsx         ← enforces manager role from session
│   ├── dashboard/page.tsx
│   ├── requests/page.tsx
│   └── team/page.tsx
└── api/
    ├── requests/route.ts
    ├── balance/route.ts
    └── team/route.ts
```

Role is read from the session JWT in `layout.tsx`. Unauthorized users are redirected server-side before any client JS executes.

---

## 5. Component Tree Architecture

### 5.1 Employee View

```
(employee)/layout.tsx                [Server — session + role guard]
└── DashboardShell                   [Server — fetches balance + summary server-side]
    ├── BalancePanel                 [Server Component wrapping BalancePanelClient]
    │   └── BalancePanelClient       [Client — React Query for refetch-on-focus]
    ├── PendingRequestsBanner        [Server — streamed via Suspense]
    └── RequestHistory               [Client — paginated, React Query]
        └── RequestCard              [Client — cancel action, optimistic delete]

(employee)/request/page.tsx          [Server — fetches balance for pre-check]
└── LeaveRequestForm                 [Client Component — full form interactivity]
    ├── DateRangePicker              [Client]
    ├── LeaveTypePicker              [Client — triggers balance preview calculation]
    ├── BalancePreview               [Client — derived from Zustand form state]
    └── SubmitButton                 [Client — Server Action handler]
```

### 5.2 Manager View

```
(manager)/layout.tsx                 [Server — session + role guard]
└── ManagerShell                     [Server]
    ├── TeamPendingRequests          [Client — React Query, real-time polling 30s]
    │   └── RequestApprovalCard      [Client — approve/reject actions]
    ├── TeamLeaveCalendar            [Client — React Query, visual overlap detection]
    └── TeamBalanceSummary           [Client — React Query, batch endpoint]
        └── EmployeeBalanceRow       [Client — drill-down modal]
```

### 5.3 Shared Components

```
components/
├── ui/                    ← presentational only, no data fetching
│   ├── Badge
│   ├── Toast
│   └── Modal
├── providers/
│   ├── QueryProvider      ← TanStack Query client setup
│   └── ToastProvider      ← global toast context
└── errors/
    ├── ErrorBoundary      ← per-section boundaries
    └── HCMUnavailableBanner  ← degraded-mode indicator
```

---

## 6. State Management Approach

### 6.1 Decision: Two Stores, No Overlap

| State Category | Tool | Reasoning |
|---|---|---|
| Server / async data | TanStack Query v5 | Purpose-built for async server state: stale-while-revalidate, deduplication, background refetch, mutation rollback |
| UI / ephemeral client state | Zustand v5 | Minimal boilerplate for synchronous client state: modal visibility, form draft, active filters |
| URL state | `searchParams` (Next.js) | Filter/pagination state survives refresh and is shareable via URL |
| Server cache | Next.js `unstable_cache` + `revalidateTag` | BFF-layer caching of HCM responses, invalidated by tag on mutation |

**Anti-patterns explicitly avoided:**
- No manual `useState` for fetched data — that is React Query's job.
- No React Query for modals — that is Zustand's job.
- No global Redux store — unnecessary for this scope.

### 6.2 Zustand Slices

```
useUIStore
  ├── requestModal: { open: boolean, prefillDates?: DateRange }
  ├── activeFilters: { status, type, dateRange }
  └── toastQueue: Toast[]

useFormStore (scoped, cleared on unmount)
  └── leaveRequestDraft: { type, startDate, endDate, notes }
```

### 6.3 TanStack Query Key Conventions

```
['balance', userId]                 ← single employee balance
['requests', userId, filters]      ← employee's own requests
['team-requests', managerId]       ← manager's pending approvals
['team-balance', managerId]        ← batch balance for team
['request', requestId]             ← single request detail
```

Keys are always tuples (never strings) for partial invalidation: `invalidateQueries({ queryKey: ['requests', userId] })` invalidates all filter variants for that user.

---

## 7. Data Fetching Strategy

### 7.1 Guiding Principle

Server Components fetch non-interactive, high-value-on-first-paint data (balance snapshot, pending count). Client components via React Query handle anything that needs refetching, user-triggered updates, or optimistic mutations.

### 7.2 Initial Page Load

```
Server Component (page.tsx)
  └── fetch('/api/balance', { next: { tags: ['balance', userId], revalidate: 300 } })
      Renders balance into HTML — zero client JS, fast FCP

  └── <Suspense fallback={<BalanceSkeleton />}>
        <BalancePanelClient />   ← hydrates with React Query, takes over for refetch
      </Suspense>
```

The server renders the initial balance into HTML. On hydration, `BalancePanelClient` initialises a React Query entry pre-populated from the server data via `initialData`. This avoids a double-fetch waterfall.

### 7.3 React Query Configuration

```
staleTime:
  balance:          5 minutes   (HCM balances change infrequently mid-day)
  requests:         60 seconds  (status changes matter quickly for managers)
  team-requests:    30 seconds  (managers need near-real-time pending queue)
  team-balance:     10 minutes  (batch endpoint, expensive, changes slowly)

gcTime:             15 minutes  (keep data in memory for instant tab switches)

refetchOnWindowFocus:
  balance:          true        (catch HCM changes while user was on another tab)
  team-requests:    true
  team-balance:     false       (avoid hammering batch endpoint)

retry:              2 retries with exponential backoff, no retry on 4xx
```

### 7.4 MSW for Development and Testing

MSW v2 intercepts all `/api/*` calls in development, simulating HCM latency (200–800ms), returning realistic data including edge cases (zero balance, overlapping requests, HCM 503 responses). This allows full frontend development without a live HCM.

---

## 8. Cache Strategy

### 8.1 Two-Layer Cache

```
┌──────────────────────────────────────────────────────────────┐
│  Layer 1: Next.js Server Cache (BFF layer)                   │
│                                                               │
│  ─ unstable_cache wraps HCM API calls in Route Handlers      │
│  ─ Keyed by: userId, managerId, requestId                    │
│  ─ Tagged: 'balance:{userId}', 'team:{managerId}'            │
│  ─ TTL: 5 min for balance, 1 min for requests                │
│  ─ Invalidated via revalidateTag() in Server Actions         │
└──────────────────────────┬───────────────────────────────────┘
                           │ served as JSON from /api/*
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Layer 2: TanStack Query Client Cache (browser)              │
│                                                               │
│  ─ Holds last-fetched response per query key                 │
│  ─ staleTime controls when background refetch triggers       │
│  ─ Invalidated by useMutation.onSuccess handlers             │
│  ─ Survives tab switches (gcTime window)                     │
└──────────────────────────────────────────────────────────────┘
```

### 8.2 Cache Lifetime Matrix

| Data | Server Cache TTL | Client staleTime | Invalidation Trigger |
|---|---|---|---|
| Leave balance | 5 min | 5 min | After request submission, after approval/rejection |
| Own requests | 1 min | 60 sec | After submit, after cancel |
| Team requests (manager) | 30 sec | 30 sec | After approval/rejection |
| Team balance (batch) | 10 min | 10 min | After any manager action |
| Employee profile | 30 min | 30 min | Never (HCM webhook only) |

### 8.3 Server Cache Tagging

Every Route Handler that proxies HCM wraps its response:

```
unstable_cache(fetchHCMBalance, ['balance', userId], {
  tags: [`balance:${userId}`],
  revalidate: 300,
})
```

Server Actions that perform mutations call:

```
revalidateTag(`balance:${userId}`)
revalidateTag(`team:${managerId}`)
```

This ensures the next server render after a mutation fetches fresh data from HCM, not stale cache.

---

## 9. Optimistic vs Pessimistic Update Strategy

### 9.1 Decision Matrix

| Action | Strategy | Reason |
|---|---|---|
| Submit leave request | **Pessimistic** | Touches HCM balance; failure is common (insufficient balance, blackout dates); wrong optimistic state causes user confusion |
| Cancel pending request | **Pessimistic** | Balance restoration is HCM-side; showing restored balance before HCM confirms is a correctness violation |
| Manager approve/reject | **Pessimistic** | Legal/HR record; silent failure with wrong UI state has compliance risk |
| Mark notification as read | **Optimistic** | Low stakes, trivially reversible, no HCM side effect |
| Update leave request notes (draft) | **Optimistic** | Local draft, not submitted to HCM yet |

### 9.2 Pessimistic Flow

```
User clicks "Submit"
  │
  ├─► Button enters loading state (disabled, spinner)
  ├─► POST /api/requests
  │
  ├─[Error response]──► Button re-enables, error toast shown, form preserved
  └─[Success response]─► invalidateQueries(['requests', userId])
                         invalidateQueries(['balance', userId])
                         Navigate to history page
                         Success toast
```

No request appears in the list until the server confirms. No balance decrements until confirmed.

### 9.3 Optimistic Flow (notifications only)

```
User clicks "Mark all read"
  │
  ├─► useMutation with onMutate: snapshot current data, apply optimistic update
  ├─► PATCH /api/notifications
  │
  ├─[Error]──► onError: queryClient.setQueryData(previous snapshot)
  └─[Success]─► onSettled: invalidateQueries(['notifications'])
```

TanStack Query v5's `onMutate` / `onError` rollback pattern is used exactly here.

---

## 10. Cache Invalidation Strategy

### 10.1 Mutation-Triggered Invalidation

Every mutation calls targeted `invalidateQueries` — never a blanket invalidation. After request submission:

```
invalidateQueries({ queryKey: ['balance', userId] })
invalidateQueries({ queryKey: ['requests', userId] })
// NOT invalidateQueries() — that would refetch everything
```

### 10.2 Server-Side Tag Invalidation

Server Actions call `revalidateTag` before returning, so the next SSR render of any page that reads that tag gets fresh HCM data. Client Query cache is invalidated separately (they are different layers).

### 10.3 Time-Based Expiry as Backstop

Even if a mutation-triggered invalidation is missed (network error, Server Action partial failure), the `staleTime` windows above ensure data is never served stale indefinitely. Balance is considered stale after 5 minutes; React Query triggers a background refetch automatically on the next component mount or window focus.

### 10.4 HCM Webhook Integration (Future / Phase 2)

When HCM supports webhooks:

```
POST /api/webhooks/hcm
  ├── Validate HMAC signature
  ├── Parse event: { type: 'balance_updated', userId, newBalance }
  ├── revalidateTag(`balance:${userId}`)
  └── Optionally: push Server-Sent Event to connected client → queryClient.invalidateQueries
```

Until webhooks are available, window-focus refetch and periodic background refetch serve as the reconciliation backstop.

---

## 11. Reconciliation Strategy for Stale Balances

### 11.1 The Problem

HCM is the source of truth but is an external system. Between user sessions, HCM may have:
- Applied accruals (balance increases)
- Processed approved requests (balance decreases)
- Applied adjustments by HR administrators

The frontend must not present a balance that contradicts HCM reality.

### 11.2 Reconciliation Mechanisms (Layered)

```
Priority 1 (immediate): Post-mutation invalidation
  ─ After any local action, both cache layers are invalidated
  ─ Guarantees: local actions are never served from stale cache

Priority 2 (background): Window-focus refetch
  ─ React Query refetchOnWindowFocus: true on balance queries
  ─ When user returns from another tab/app, balance is silently re-fetched
  ─ If changed, React Query re-renders with fresh value (no user action needed)

Priority 3 (periodic): Background polling
  ─ Manager's team-requests query polls every 30 seconds
  ─ Employee balance has staleTime: 5 min → React Query refetches every 5 min
     while component is mounted

Priority 4 (explicit): Manual refresh
  ─ "Refresh balance" button available in the balance panel
  ─ Calls queryClient.invalidateQueries(['balance', userId])
  ─ Shows last-synced timestamp to user

Priority 5 (session): On navigation
  ─ React Query refetches stale queries on component mount
  ─ Navigating to /dashboard always gets fresh data if staleTime has elapsed
```

### 11.3 Staleness Indicator

Every balance display shows a `last synced: X minutes ago` timestamp derived from `dataUpdatedAt` on the React Query result. If the last successful sync is more than 15 minutes old (e.g., network issues), a visible warning banner appears:

```
⚠️ Balance data may be outdated. Last synced 18 minutes ago. [Refresh]
```

### 11.4 Conflict Resolution on Contradiction

If a user submits a request and the server returns `INSUFFICIENT_BALANCE` when the client displayed sufficient balance:

1. Form does not submit (pessimistic — server is authoritative)
2. Error message: "Your balance has changed. Current balance: X days."
3. React Query entry for balance is immediately invalidated and re-fetched
4. Form is preserved so user can adjust dates

---

## 12. Silent Failures & Delayed Contradictions

### 12.1 The Problem

HCM may exhibit two failure patterns that are worse than immediate errors:

**Pattern A — Silent accept, async reject:** HCM accepts the request submission with HTTP 200 but later (minutes to hours) marks it as invalid (e.g., entitlement recalculation, retroactive adjustment). The user sees "Pending" but the request will never be approved.

**Pattern B — Contradicted approval:** A manager approves a request. HCM accepts the approval but a subsequent batch job rejects it due to company-wide blackout being added. The request reverts to rejected without the manager taking any action.

### 12.2 Detection Mechanisms

```
Mechanism 1: Status polling
  ─ Submitted requests are polled every 2 minutes if in "Pending" state
  ─ React Query refetchInterval: (data) => data?.status === 'pending' ? 120_000 : false
  ─ When status unexpectedly changes, trigger reconciliation flow

Mechanism 2: Request list background sync
  ─ The full request history is re-fetched on window focus
  ─ React Query compares previous and current data
  ─ Status regressions (pending→rejected, approved→cancelled) trigger toast

Mechanism 3: Manager action result verification
  ─ After manager approves, the system re-fetches the specific request after 5 seconds
  ─ If status differs from expected, contradiction toast is shown

Mechanism 4: Session reconciliation
  ─ On app load / session restore, a background job checks all open requests
     against HCM and surfaces any that changed while user was away
```

### 12.3 User Surfacing

When a delayed contradiction is detected:

| Scenario | UX Response |
|---|---|
| Request silently rejected by HCM | Toast: "Your [leave type] request for [dates] was rejected by HCM. Reason: [reason if available]." Badge count updates. |
| Approved request later cancelled by HCM | Toast: "A previously approved request was cancelled. Please resubmit." |
| Manager's approval overridden | Toast (manager): "Your approval of [employee]'s request was overridden." |

All contradiction toasts are persistent (require manual dismiss) to avoid missing them on brief appearances.

### 12.4 Idempotency

Every mutation request carries an idempotency key (`crypto.randomUUID()`, stored in sessionStorage per form instance). If a network timeout causes the user to retry, the BFF layer deduplicates the request and returns the original result rather than creating a duplicate record.

---

## 13. Batch vs Real-Time Endpoint Strategy

### 13.1 Endpoint Classification

| Endpoint | Type | Rationale |
|---|---|---|
| `GET /api/balance?userId` | Real-time (single) | Called per employee, must be fresh |
| `GET /api/team/balances?managerId` | Batch | Returns all team member balances in one HCM call; cheaper than N individual calls |
| `GET /api/requests?userId` | Real-time paginated | User's own requests — always fresh |
| `GET /api/team/requests?managerId` | Real-time paginated | Manager's approval queue — 30s polling |
| `GET /api/team/calendar?managerId` | Batch | Full team leave calendar for current + next month; expensive, cached 10 min |
| `POST /api/requests` | Real-time | Single mutation |
| `PATCH /api/requests/:id` | Real-time | Single mutation |

### 13.2 Batch Endpoint Design

The team balance batch endpoint returns a map keyed by `userId`:

```json
{
  "data": {
    "user-123": { "annual": 10, "sick": 5, "lastSynced": "2026-06-05T09:00:00Z" },
    "user-456": { "annual": 3, "sick": 8, "lastSynced": "2026-06-05T09:00:00Z" }
  },
  "syncedAt": "2026-06-05T09:00:00Z"
}
```

React Query stores this under `['team-balance', managerId]` and individual components derive per-employee data via selector functions — no waterfall of individual requests.

### 13.3 Batch → Real-Time Transition

When a manager approves a request for `user-123`, the team batch cache is invalidated. The next render fetches the batch again. There is no granular partial cache update — correctness trumps the small refetch cost here.

For the employee's own balance, an individual real-time fetch is made post-mutation rather than using the stale batch data, because the employee view needs guarantee freshness.

### 13.4 Handling HCM Batch Latency

The batch endpoint may take 1–3 seconds on HCM's side. The BFF layer:
1. Returns a cached response immediately (if within TTL)
2. Triggers a background revalidation
3. Streams the Suspense boundary to the browser while batch resolves

The manager's team balance panel shows a skeleton until the first batch resolves, then instant cache hits for subsequent renders within TTL.

---

## 14. Error Handling UX Strategy

### 14.1 Error Taxonomy

| Error Class | Source | UX Treatment |
|---|---|---|
| Validation error | Client-side (form) | Inline field error, no network call made |
| Business rule error | BFF / HCM (4xx) | Inline contextual error near the action |
| Transient error | Network timeout, 503 | Toast with retry button; React Query auto-retries 2x |
| Authentication error | 401 | Hard redirect to login |
| Authorization error | 403 | Inline "You don't have permission" message |
| HCM unavailable | 5xx from HCM | Degraded mode banner (§14.4) |
| Unexpected error | 500, JS exception | Error boundary fallback with "something went wrong" |

### 14.2 Error Boundaries

React error boundaries wrap each major section, not the entire app:

```
<ErrorBoundary fallback={<BalanceError />}>
  <BalancePanel />
</ErrorBoundary>

<ErrorBoundary fallback={<RequestListError />}>
  <RequestHistory />
</ErrorBoundary>
```

A balance fetch failure does not crash the request history UI.

### 14.3 Form Submission Errors

Failed submissions preserve all form data. Error messages are displayed:
- Inline under the relevant field (e.g., "Insufficient balance for the selected dates")
- As a form-level summary above the submit button for multi-field errors

The submit button returns to its enabled state immediately after a failure — no manual page refresh required.

### 14.4 Degraded Mode (HCM Unavailable)

When HCM returns consecutive 5xx errors or times out:

```
┌─────────────────────────────────────────────────────────────────────┐
│ ⚠️  Leave balance data is temporarily unavailable. Displayed         │
│    balances may be outdated. Request submissions are disabled.       │
│    We'll retry automatically. [Retry now]                           │
└─────────────────────────────────────────────────────────────────────┘
```

Behaviour in degraded mode:
- Read operations: show last cached data with staleness warning
- Submit / approve / reject: **disabled** with explanation tooltip
- The new request form shows a disabled submit button (not hidden — preserves user's draft)
- Retry runs on 30-second interval; banner dismisses automatically on recovery

### 14.5 Toast Notification Design

| Priority | Behaviour | Examples |
|---|---|---|
| Success | Auto-dismiss after 4s | "Request submitted", "Approved" |
| Info | Auto-dismiss after 6s | "Balance refreshed" |
| Warning | Auto-dismiss after 8s | "Balance may be outdated" |
| Error | Persistent, manual dismiss | Mutation failure, delayed contradiction |

Maximum 3 toasts visible simultaneously; older ones are removed as new ones arrive (FIFO queue managed in Zustand `toastQueue`).

---

## 15. Testing Strategy Overview

### 15.1 Unit Tests

- **Pure functions:** date range validators, balance calculators, conflict detectors
- **Zustand stores:** each action/selector tested with initial state permutations
- **React Query custom hooks:** tested with `@tanstack/react-query`'s `renderHook` + MSW for network mocking

### 15.2 Component Tests (Storybook + Vitest/Testing Library)

Each component in Storybook has:
- **Default story:** happy path with realistic data
- **Loading story:** skeleton state
- **Error story:** each error class in §14.1
- **Edge case stories:** zero balance, maximum date range, concurrent approvals

Component tests using Testing Library assert:
- Correct text rendered from mock data
- Form validation messages appear/disappear correctly
- Buttons are disabled in degraded mode
- Error boundaries render fallback on thrown errors

### 15.3 Integration Tests

- Full mutation flows with MSW: submit → success path, submit → balance error, submit → HCM 503
- Cache invalidation verification: after mutation, query re-fetches
- Optimistic rollback: notification mark-read fails → UI reverts
- Role gating: manager routes redirect non-managers at server level

### 15.4 End-to-End Tests (Playwright)

- Employee happy path: login → view balance → submit request → confirm pending state
- Manager happy path: login → view pending → approve → confirm approved state
- Contradiction flow: MSW simulates delayed rejection → verify toast appears
- Degraded mode: MSW returns 503 → verify banner, verify form disabled

### 15.5 MSW Scenario Coverage

MSW handlers should cover the following scenarios that are otherwise difficult to test:
- HCM accepts immediately (200)
- HCM rejects immediately with balance error (422)
- HCM accepts then async contradicts (200 followed by status change on next poll)
- HCM 503 (batch endpoint unavailable)
- Slow HCM response (>2s latency, test skeleton states)
- Idempotency deduplication (duplicate POST returns original 200)

---

## 16. Trade-offs

### 16.1 Pessimistic Updates Everywhere (except notifications)

**Chosen:** Block UI until server confirms.  
**Alternative:** Optimistic updates for request submission.  
**Trade-off:** Optimistic submission would feel faster but risks showing a balance decrement that HCM reverses. Given that HCM is an external system with its own validation logic, false optimism leads to confusing contradictions (user sees "request submitted" then "request failed" seconds later). The delay cost of pessimistic updates (~500ms spinner) is worth the correctness guarantee.

### 16.2 Two-Layer Caching (Server + Client)

**Chosen:** Next.js server cache + TanStack Query client cache.  
**Alternative:** Server cache only, or client cache only.  
**Trade-off:** Two layers add complexity (two invalidation paths). However: server cache reduces HCM load and enables fast SSR; client cache enables instant navigation and background sync. Omitting either layer creates either a slow initial render (no server cache) or constant HCM load (no client cache). The complexity is managed by strict ownership: server cache = HCM proxy data, client cache = interactive views.

### 16.3 React Query over SWR

**Chosen:** TanStack Query v5 (already in `package.json`).  
**Alternative:** SWR.  
**Trade-off:** SWR is simpler but lacks mutation management, optimistic update helpers (`onMutate` / `onError`), and fine-grained partial invalidation. TanStack Query v5's `useMutation` with rollback support is essential for the reconciliation patterns required here. The additional bundle size (~12kb gzipped over SWR) is justified.

### 16.4 Polling over WebSockets for Manager Queue

**Chosen:** 30-second polling.  
**Alternative:** WebSocket or Server-Sent Events for push.  
**Trade-off:** WebSockets require server-side connection management infrastructure and a compatible hosting environment. Polling at 30 seconds is adequate for a human-speed approval workflow (managers are not watching a live ticker) and is trivially deployable. If HCM adds webhook support (§10.4), SSE can be layered on top without replacing the polling fallback.

### 16.5 Batch Endpoint for Team Balances

**Chosen:** Single batch endpoint returning all team member balances.  
**Alternative:** Individual `useQuery` per team member.  
**Trade-off:** N individual queries for an N-person team creates N parallel HCM requests, N React Query entries, and N separate loading/error states. For a team of 20, this is noisy and expensive. A single batch query with a selector pattern is cleaner, though it means one team member's balance error affects the whole team panel. This is acceptable: if HCM is having problems with one employee, it is likely having problems with all.

---

## 17. Risks

### R1 — HCM Eventual Consistency Window

**Description:** HCM processes accruals and adjustments in batches. The balance returned by HCM at request time may not include an accrual that runs 30 minutes later.  
**Severity:** Medium  
**Mitigation:** Show `lastSynced` timestamp. Window-focus refetch catches changes. Accept that submitted requests based on slightly stale balances may be rejected by HCM's own validation.  
**Residual risk:** User frustration if they see "sufficient balance" but submit fails after an accrual run.

### R2 — Silent Failure Detection Latency

**Description:** Pattern A contradictions (§12.1) may not surface for up to 2 minutes (polling interval).  
**Severity:** Low-Medium  
**Mitigation:** Polling interval tunable. For high-sensitivity deployments, replace with SSE. User is never shown a definitive "approved" status until HCM confirms.  
**Residual risk:** User submits a second request while first is in silent-fail state.

### R3 — Server Cache Inconsistency Under Multi-Instance Deployment

**Description:** Next.js `unstable_cache` is local to the server instance. In multi-replica deployments, `revalidateTag` only invalidates the instance that processed the mutation.  
**Severity:** High if deployed multi-instance without shared cache handler  
**Mitigation:** Implement a shared Redis cache handler (see Next.js custom `cacheHandlers` API). Until then, document this as a single-instance constraint or use `revalidate: 0` on critical balance routes.  
**Residual risk:** Brief (sub-TTL) stale balance on other instances.

### R4 — HCM API Rate Limits

**Description:** Manager batch endpoint may hit HCM rate limits under concurrent user load.  
**Severity:** Medium  
**Mitigation:** Server-side caching absorbs most requests. Add request coalescing in the BFF layer (deduplicate concurrent calls with the same key). Circuit breaker pattern for repeated 429 responses.  
**Residual risk:** Cold cache after deployment causes burst load.

### R5 — Idempotency Key Collision on Retry

**Description:** If `sessionStorage` is cleared between retry attempts (rare), a new idempotency key is generated, potentially duplicating the request in the Time-Off service.  
**Severity:** Low  
**Mitigation:** Time-Off service deduplicates by (userId, leaveType, startDate, endDate) as a secondary guard. Frontend idempotency key is the first line; DB unique constraint is the last.  
**Residual risk:** Extremely rare duplicate in audit log.

### R6 — React Query Cache Memory Growth

**Description:** In a long-running session with many employees navigated through, the React Query cache accumulates entries. With `gcTime: 15 min`, entries for departed employees stay in memory.  
**Severity:** Low  
**Mitigation:** `gcTime` of 15 minutes is well within browser memory bounds for the expected dataset size. Monitor with `queryClient.getQueryCache().getAll().length`. Consider `gcTime: 5 min` for team-balance entries if memory becomes a concern.

---

## 18. Appendix — Diagrams

### A. Request Submission Flow (Pessimistic)

```
Employee                BFF Layer              HCM System
    │                       │                       │
    │  POST /api/requests   │                       │
    │──────────────────────►│                       │
    │  [button: loading]    │                       │
    │                       │  POST /hcm/requests   │
    │                       │──────────────────────►│
    │                       │                       │ validate balance
    │                       │                       │ check blackouts
    │                       │◄──────────────────────│
    │                       │  200 OK {requestId}   │
    │◄──────────────────────│                       │
    │  [navigate to history]│                       │
    │  invalidate queries   │                       │
    │  [button: re-enabled] │                       │
```

### B. Delayed Contradiction Detection

```
Time 0:     Employee submits request → status: PENDING
Time 0:     React Query: polls every 2 min (request in pending state)
Time 1 min: Poll → still PENDING (no change)
Time 3 min: HCM batch job runs → rejects request (entitlement expired)
Time 4 min: Poll → status: REJECTED_BY_HCM
Time 4 min: React Query detects status regression
            → invalidate ['balance', userId]
            → show persistent error toast
            → update request in history list
```

### C. Cache Invalidation Chain on Approval

```
Manager clicks "Approve" on request-abc for employee-xyz
  │
  ├─ POST /api/requests/abc/approve (Server Action)
  │     │
  │     ├─ PATCH HCM /requests/abc → 200 OK
  │     ├─ revalidateTag('balance:xyz')
  │     ├─ revalidateTag('team:manager-id')
  │     └─ return { success: true, updatedRequest }
  │
  └─ useMutation.onSuccess:
        invalidateQueries(['team-requests', managerId])
        invalidateQueries(['team-balance', managerId])
        invalidateQueries(['balance', 'xyz'])   ← employee's cache also cleared
```

### D. Degraded Mode State Machine

```
        ┌─────────┐
        │  NORMAL │ ◄────────────────────────────────────┐
        └────┬────┘                                       │
             │ HCM 5xx (2 consecutive)                    │ HCM 200
             ▼                                            │
        ┌──────────┐    Retry every 30s               ┌──┴────────┐
        │ DEGRADED │──────────────────────────────────► RECOVERING │
        └──────────┘                                  └────────────┘
        ─ Balance shown with staleness warning
        ─ Submit / Approve / Reject disabled
        ─ Banner displayed
        ─ Read-only mode
```

### E. Stale Balance Reconciliation Ladder

```
Trigger                         Freshness guarantee
──────────────────────────────────────────────────────
1. Post-mutation invalidation   Immediate (< 1s)
2. Window-focus refetch         On next focus event
3. Periodic staleness expiry    Within staleTime window (5 min)
4. Manual refresh button        On user demand
5. Session reconciliation       On app load
──────────────────────────────────────────────────────
Each layer is a fallback if the one above did not fire.
```
