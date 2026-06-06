import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, screen, waitFor } from 'storybook/test'
import { queryKeys } from '@/lib/query/keys'
import { PendingRequestsBanner } from '@/components/employee/PendingRequestsBanner/PendingRequestsBanner'
import { withQueryData, withToasts, getStoryQueryClient } from './_decorators'
import {
  ALICE_PENDING,
  ALICE_HCM_REJECT,
  ALICE_PENDING_THEN_REJECTED,
  hcmRequestsResponse,
} from './_fixtures'

const meta = {
  title: 'TimeOff/PendingRequestsBanner',
  component: PendingRequestsBanner,
  decorators: [withToasts],
  args: { userId: 'user-emp-001' },
} satisfies Meta<typeof PendingRequestsBanner>

export default meta
type Story = StoryObj<typeof meta>

// Component renders null while loading — canvas is empty during initial fetch
export const Loading: Story = {
  beforeEach() {
    const orig = global.fetch
    global.fetch = () => new Promise(() => {})
    return () => { global.fetch = orig }
  },
}

// No active requests — component returns null, canvas is intentionally empty
export const Empty: Story = {
  decorators: [withQueryData([[queryKeys.requests('user-emp-001'), []]])],
}

// One pending request — shows "Active Requests" section with leave details
export const WithPending: Story = {
  decorators: [withQueryData([[queryKeys.requests('user-emp-001'), [ALICE_PENDING]]])],
}

// Request was rejected by HCM — red row, "HCM rejected" message, contradiction count badge
export const HCMContradiction: Story = {
  decorators: [withQueryData([[queryKeys.requests('user-emp-001'), [ALICE_HCM_REJECT]]])],
}

// Mix of pending + rejected_by_hcm — shows "1 HCM contradiction detected" in header
export const MixedStates: Story = {
  decorators: [withQueryData([[queryKeys.requests('user-emp-001'), [ALICE_PENDING, ALICE_HCM_REJECT]]])],
}

// Simulates a mid-session silent HCM rejection:
//   1. Initial cache shows the request as PENDING
//   2. play() triggers a refetch that returns REJECTED_BY_HCM (same request ID)
//   3. useRequests detects the PENDING → REJECTED_BY_HCM transition
//   4. A persistent error toast fires and the balance cache is invalidated
export const HCMSilentFailure: Story = {
  decorators: [
    withQueryData([[queryKeys.requests('user-emp-001'), [ALICE_PENDING]]]),
  ],
  beforeEach() {
    const orig = global.fetch
    global.fetch = async (input) => {
      const url = String(input)
      if (url.includes('/api/hcm/requests?employeeId=')) {
        return new Response(
          JSON.stringify(hcmRequestsResponse([ALICE_PENDING_THEN_REJECTED])),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      if (url.includes('/api/hcm/balance')) {
        // balance invalidation refetch — return a benign 503 to avoid flicker
        return new Response('{}', { status: 503 })
      }
      return orig(input as RequestInfo)
    }
    return () => { global.fetch = orig }
  },
  play: async () => {
    // Force a refetch to simulate the HCM silently changing the request status
    const qc = getStoryQueryClient()
    qc?.invalidateQueries({ queryKey: queryKeys.requests('user-emp-001') })

    // useRequests detects the PENDING → REJECTED_BY_HCM transition and surfaces a toast
    await waitFor(
      () => expect(screen.getByRole('alert')).toBeTruthy(),
      { timeout: 4000 }
    )
  },
}
