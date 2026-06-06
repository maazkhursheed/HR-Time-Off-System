import type { Employee, Manager } from '@/types/user'

export const MOCK_EMPLOYEE: Employee = {
  id: 'user-emp-001',
  email: 'alice@example.com',
  name: 'Alice Chen',
  role: 'employee',
  teamId: 'team-001',
  managerId: 'user-mgr-001',
}

export const MOCK_MANAGER: Manager = {
  id: 'user-mgr-001',
  email: 'bob@example.com',
  name: 'Bob Smith',
  role: 'manager',
  teamId: 'team-001',
  directReportIds: ['user-emp-001', 'user-emp-002'],
}

export const MOCK_TEAM_MEMBERS = [
  { id: 'user-emp-001', name: 'Alice Chen' },
  { id: 'user-emp-002', name: 'Carlos Rivera' },
]
