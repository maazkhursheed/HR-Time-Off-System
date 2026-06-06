export type Role = 'employee' | 'manager'

export interface User {
  id: string
  email: string
  name: string
  role: Role
  managerId?: string
}

export interface Session {
  user: User
  expiresAt: string
}

export interface Employee extends User {
  role: 'employee'
  teamId: string
}

export interface Manager extends User {
  role: 'manager'
  teamId: string
  directReportIds: string[]
}
