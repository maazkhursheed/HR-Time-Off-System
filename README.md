# Time-Off App

Take-home assessment project for Wizdaa. A time-off management frontend built with Next.js 16 App Router.

## Stack

- **Next.js 16** (App Router, Server Components, Server Actions)
- **React 19**
- **TanStack Query v5** — async server state
- **Zustand v5** — synchronous UI state
- **Tailwind CSS v4**
- **MSW v2** — mock HCM backend
- **Vitest + Testing Library** — unit and hook tests
- **Storybook 10** — component stories and interaction tests

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
npm run storybook  # http://localhost:6006
npm test           # vitest
```

## Project structure

```
app/            Next.js App Router pages and API routes
components/     React components (employee/, manager/, ui/, errors/)
domain/         Pure business logic — no React, no network
lib/            Query hooks, mutations, server actions, services
mocks/          MSW handlers and fixtures
store/          Zustand stores
stories/        Storybook stories (stories/timeoff/)
types/          Shared TypeScript types
__tests__/      Vitest test suite
```

## Key docs

- [`TRD.md`](./TRD.md) — Technical Requirements Document
