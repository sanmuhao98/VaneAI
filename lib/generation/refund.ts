import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

// Refund a FAILED job's credits exactly once. Idempotency is enforced by the
// uq_ledger_refund_once partial unique index — concurrent/retried calls hit a
// unique violation and report refunded: false. Safe under Inngest retries.
export async function refundFailedJob(jobId: string): Promise<{ refunded: boolean; reason?: string }> {
  const admin = createAdminClient()

  const { data: job, error: jErr } = await admin
    .from('generation_jobs')
    .select('id, user_id, status, credits_cost')
    .eq('id', jobId)
    .maybeSingle()
  if (jErr) throw jErr
  if (!job) throw new Error(`job not found: ${jobId}`)
  if (job.status !== 'failed') return { refunded: false, reason: `status=${job.status}` }
  if (!job.credits_cost || job.credits_cost <= 0) return { refunded: false, reason: 'nothing charged' }

  const { error } = await admin.from('credit_ledger').insert({
    user_id: job.user_id,
    delta: job.credits_cost,
    reason: 'refund',
    ref_job_id: jobId,
  })
  if (error) {
    if (error.code === '23505') return { refunded: false, reason: 'already refunded' }
    throw error
  }
  return { refunded: true }
}
