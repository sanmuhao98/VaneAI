import { generationFailed, inngest } from '@/inngest/client'
import { refundFailedJob } from '@/lib/generation/refund'

// retries: 2 is safe — refundFailedJob is idempotent (uq_ledger_refund_once index).
export const refundOnFailure = inngest.createFunction(
  { id: 'refund-on-failure', retries: 2, triggers: [generationFailed] },
  async ({ event, step }) => {
    return step.run('refund', () => refundFailedJob(event.data.jobId))
  },
)
