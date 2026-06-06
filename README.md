# Time-Off App

Take-home assessment project.

A Time-Off Management frontend built with **Next.js 16 App Router**, focusing on:
- optimistic vs pessimistic updates
- reconciliation with external HCM system
- cross-tab synchronization
- robust UI state handling

---

## 🚀 Tech Stack

- Next.js 16 (App Router, Server Components, Server Actions)
- React 19
- TypeScript
- TanStack Query v5 — server state management
- Zustand v5 — client/UI state
- Tailwind CSS v4
- MSW v2 — mock HCM backend simulation
- Storybook 10 — UI states & interaction testing
- Vitest + Testing Library — unit + integration tests

---

## 📦 Getting Started

```bash
npm install
npm run dev
```

➡ http://localhost:3000

---

## 📖 Run Storybook

```bash
npm run storybook
```

➡ http://localhost:6006

---

## 🧪 Run Tests

```bash
npm test
```

---

## 📊 Coverage (optional)

```bash
npm run test:coverage
```

---

## 🏗 Production Build

```bash
npm run build
npm start
```

---

## 🧠 Architecture Overview

See TRD.md for full system design.

Key principles:
- HCM is source of truth
- React Query handles server state
- Zustand handles UI state only
- strict cache invalidation strategy
- reconciliation via polling + window focus + cross-tab sync

---

## 🧪 Mock HCM System (MSW)

Simulates:
- balance API (real-time)
- batch balance API
- request submission
- silent failures
- inconsistent responses
- anniversary balance changes

---

## 📁 Project Structure

app/            Next.js App Router routes
components/     UI components
domain/         business logic
lib/            hooks + API layer
mocks/          MSW handlers
store/          Zustand stores
stories/        Storybook
types/          TypeScript types
__tests__/      Vitest tests

---

## Key docs

- [`TRD.md`](./TRD.md) — Technical Requirements Document