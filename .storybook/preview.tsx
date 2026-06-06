import React from 'react'
import type { Preview, Decorator } from '@storybook/nextjs-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '../app/globals.css'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  })
}

// Global decorator: each story gets a stable QueryClient (recreated on mount, not on re-render)
const withQueryClient: Decorator = (Story) => {
  const qcRef = React.useRef<QueryClient | null>(null)
  if (!qcRef.current) qcRef.current = makeQueryClient()
  return (
    <QueryClientProvider client={qcRef.current}>
      <Story />
    </QueryClientProvider>
  )
}

const preview: Preview = {
  decorators: [withQueryClient],
  parameters: {
    // Tell @storybook/nextjs-vite to activate App Router mode globally.
    // This makes RouterDecorator (built into the framework's preview) wrap
    // every story with AppRouterProvider, which provides AppRouterContext.
    // The framework's loaders() call createNavigation() before each story,
    // seeding the navigationAPI that AppRouterProvider.getRouter() returns.
    // Without this flag, RouterDecorator falls back to PageRouterProvider
    // (RouterContext only), and useRouter() from next/navigation throws
    // "invariant expected app router to be mounted" because AppRouterContext
    // is null.
    nextjs: {
      appDirectory: true,
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: 'padded',
  },
}

export default preview

export { makeQueryClient }