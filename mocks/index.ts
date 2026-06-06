export { balanceHandlers } from './handlers/balance'
export { requestHandlers } from './handlers/requests'
export { teamHandlers } from './handlers/team'
export { notificationHandlers } from './handlers/notifications'

import { balanceHandlers } from './handlers/balance'
import { requestHandlers } from './handlers/requests'
import { teamHandlers } from './handlers/team'
import { notificationHandlers } from './handlers/notifications'

export const handlers = [
  ...balanceHandlers,
  ...requestHandlers,
  ...teamHandlers,
  ...notificationHandlers,
]
