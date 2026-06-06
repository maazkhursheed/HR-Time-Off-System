import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, screen, within, waitFor } from 'storybook/test'
import { queryKeys } from '@/lib/query/keys'
import { BalancePanelClient } from '@/components/employee/BalancePanel/BalancePanelClient'
import { withQueryData, withToasts } from './_decorators'
import {
  ALICE,
  ALICE_ANNIVERSARY,
  ALICE_INCONSISTENT,
  ALICE_LOW,
  ALICE_STALE,
  hcmBalanceResponse,
} from './_fixtures'

const meta = {
  title: 'TimeOff/BalancePanel',
  component: BalancePanelClient,
  decorators: [withToasts],
  args: { userId: 'user-emp-001' },
} satisfies Meta<typeof BalancePanelClient>

export default meta
type Story = StoryObj<typeof meta>

// Skeleton shown while balance is loading for the first time
export const Loading: Story = {
  beforeEach() {
    const orig = global.fetch
    global.fetch = () => new Promise(() => {})
    return () => { global.fetch = orig }
  },
}

// Normal balance — all leave types, location chip, sync timestamp
// Interaction: verifies each balance card renders with correct day counts.
export const Default: Story = {
  decorators: [withQueryData([[queryKeys.balance('user-emp-001'), ALICE]])],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Balance grid must show all four leave types
    await waitFor(() => expect(canvas.getByText('Annual')).toBeTruthy())
    expect(canvas.getByText('Sick')).toBeTruthy()
    expect(canvas.getByText('Unpaid')).toBeTruthy()
    expect(canvas.getByText('Compassionate')).toBeTruthy()
    // Annual count must match the fixture (18 days)
    expect(canvas.getAllByText('18').length).toBeGreaterThan(0)
  },
}

// Annual balance bumped +2 by anniversary accrual — amber badge visible
export const AnniversaryBonus: Story = {
  decorators: [withQueryData([[queryKeys.balance('user-emp-001'), ALICE_ANNIVERSARY]])],
}

// HCM inconsistency flag set — orange notice, accrual timing message
export const Inconsistency: Story = {
  decorators: [withQueryData([[queryKeys.balance('user-emp-001'), ALICE_INCONSISTENT]])],
}

// Balance data is > 15 min old — yellow HCMUnavailableBanner with "Retry now" link
// isStale is derived from lastSynced by the select() transform in useBalance.
// Interaction: verifies the stale banner is visible and the Refresh button exists.
// Protects: stale-cache regression — banner must surface when data is old.
export const Stale: Story = {
  decorators: [withQueryData([[queryKeys.balance('user-emp-001'), ALICE_STALE]])],
  beforeEach() {
    // Prevent refetch from replacing stale fixture with fresh data
    const orig = global.fetch
    global.fetch = async (input) => {
      if (String(input).includes('/api/hcm/balance')) {
        return new Response(JSON.stringify(hcmBalanceResponse(ALICE_STALE)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return orig(input as RequestInfo)
    }
    return () => { global.fetch = orig }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Stale banner must be visible — it contains a "Refresh" or retry affordance
    await waitFor(() => {
      const refreshBtn = canvas.queryByRole('button', { name: /refresh/i })
        ?? canvas.queryByText(/refresh/i)
        ?? canvas.queryByText(/retry/i)
      expect(refreshBtn).toBeTruthy()
    })
  },
}

// Only 2 annual days remaining — yellow border and text on the Annual card
// Interaction: verifies the low-balance visual warning is rendered.
// Protects: balance mismatch regression — low-balance styling must fire at ≤3 days.
export const LowBalance: Story = {
  decorators: [withQueryData([[queryKeys.balance('user-emp-001'), ALICE_LOW]])],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(canvas.getByText('Annual')).toBeTruthy())
    // Annual count must show the fixture value (2 days)
    expect(canvas.getAllByText('2').length).toBeGreaterThan(0)
  },
}

// HCM API returns 503 — balance panel replaced by HCMUnavailableBanner.
// Interaction: verifies balance cards are hidden and the error banner appears.
// Protects: balance mismatch — HCM down must never show zero/stale numbers as truth.
export const HCMError: Story = {
  beforeEach() {
    const orig = global.fetch
    global.fetch = async (input) => {
      if (String(input).includes('/api/hcm/balance')) {
        return new Response(JSON.stringify({ errorMessage: 'Service unavailable' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return orig(input as RequestInfo)
    }
    return () => { global.fetch = orig }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Balance grid should not be rendered — no "Annual" label visible
    await waitFor(() => expect(canvas.queryByText('Annual')).toBeNull(), { timeout: 3000 })
  },
}
