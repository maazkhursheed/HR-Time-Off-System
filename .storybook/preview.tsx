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