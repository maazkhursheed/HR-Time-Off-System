import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { queryKeys } from '@/lib/query/keys'
import { TeamBalanceSummary } from '@/components/manager/TeamBalanceSummary/TeamBalanceSummary'
import { withQueryData } from './_decorators'
import { ALICE, CARLOS, DIANA } from './_fixtures'
import type { RichBalance } from '@/lib/query/balance'

const MANAGER_ID = 'user-mgr-001'
const TEAM_IDS = ['user-emp-001', 'user-emp-002', 'user-emp-003']
// Matches the sort in useTeamBalanceBatch so withQueryData pre-populates the correct cache key.
const TEAM_IDS_SORTED = [...TEAM_IDS].sort()
const TEAM_BALANCE_KEY = [...queryKeys.teamBalance(MANAGER_ID), TEAM_IDS_SORTED]

const DIANA_LOW: RichBalance = {
  ...DIANA,
  annual: 2, // ≤3 threshold — annual cell turns yellow
}

const CARLOS_ANNIVERSARY: RichBalance = {
  ...CARLOS,
  anniversaryBonusApplied: true, // shows "+bonus" badge in last column
}

const meta = {
  title: 'TimeOff/TeamBalanceSummary',
  component: TeamBalanceSummary,
  args: { managerId: MANAGER_ID, teamMemberIds: TEAM_IDS },
} satisfies Meta<typeof TeamBalanceSummary>

export default meta
type Story = StoryObj<typeof meta>

// SkeletonText shown while the batch balance endpoint is loading
export const Loading: Story = {
  beforeEach() {
    const orig = global.fetch
    global.fetch = () => new Promise(() => {})
    return () => { global.fetch = orig }
  },
}

// All three employees with healthy balances — default manager view
export const Default: Story = {
  decorators: [
    withQueryData([
      [TEAM_BALANCE_KEY, [ALICE, CARLOS, DIANA]],
    ]),
  ],
}

// Diana's annual balance ≤3 — annual cell is yellow (low-balance warning)
export const LowBalance: Story = {
  decorators: [
    withQueryData([
      [TEAM_BALANCE_KEY, [ALICE, CARLOS, DIANA_LOW]],
    ]),
  ],
}

// Carlos hit his hire-date anniversary window — "+bonus" badge visible in his row
export const AnniversaryBonus: Story = {
  decorators: [
    withQueryData([
      [TEAM_BALANCE_KEY, [ALICE, CARLOS_ANNIVERSARY, DIANA]],
    ]),
  ],
}

// HCM batch endpoint returns 503 — component shows "Could not load team balances." error
export const HCMError: Story = {
  beforeEach() {
    const orig = global.fetch
    global.fetch = async () => new Response(null, { status: 503 })
    return () => { global.fetch = orig }
  },
}
