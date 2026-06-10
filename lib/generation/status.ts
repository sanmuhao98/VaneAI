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

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  pending: '排队中',
  running: '生成中',
  succeeded: '已完成',
  failed: '失败',
  canceled: '已取消',
}
