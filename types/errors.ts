export type ErrorCode =
  | 'INSUFFICIENT_BALANCE'
  | 'BLACKOUT_DATE'
  | 'OVERLAP_CONFLICT'
  | 'MIN_NOTICE_VIOLATION'
  | 'HCM_UNAVAILABLE'
  | 'HCM_REJECTED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'DUPLICATE_REQUEST'
  | 'INVALID_STATUS_TRANSITION'
  | 'UNKNOWN'

export interface AppError {
  code: ErrorCode
  message: string
  field?: string
}

export interface HCMError extends AppError {
  hcmCode?: string
  hcmMessage?: string
}

export interface ValidationError extends AppError {
  code: 'INSUFFICIENT_BALANCE' | 'BLACKOUT_DATE' | 'OVERLAP_CONFLICT' | 'MIN_NOTICE_VIOLATION'
  field: string
}

export function isValidationError(e: AppError): e is ValidationError {
  return ['INSUFFICIENT_BALANCE', 'BLACKOUT_DATE', 'OVERLAP_CONFLICT', 'MIN_NOTICE_VIOLATION'].includes(e.code)
}

export function isHCMError(e: AppError): e is HCMError {
  return e.code === 'HCM_UNAVAILABLE' || e.code === 'HCM_REJECTED'
}
