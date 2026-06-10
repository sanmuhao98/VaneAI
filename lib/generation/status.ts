export type JobStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'canceled'

export function isTerminal(s: JobStatus): boolean {
  return s === 'succeeded' || s === 'failed' || s === 'canceled'
}

export function canCancel(s: JobStatus): boolean {
  return s === 'pending' || s === 'running'
}

export function canRetry(s: JobStatus): boolean {
  return s === 'failed' || s === 'canceled'
}
