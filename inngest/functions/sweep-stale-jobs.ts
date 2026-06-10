import { cron } from 'inngest'
import { generationFailed, inngest } from '@/inngest/client'
import { createAdminClient } from '@/lib/supabase/admin'

const STALE_AFTER_MS = 10 * 60_000

// Process crashes / deploys mid-run can strand jobs in pending/running where no
// catch path reaches them. With credits charged at creation, a stranded job is a
// refund liability — fail it out and let refund-on-failure compensate.
export const sweepStaleJobs = inngest.createFunction(
  { id: 'sweep-stale-jobs', retries: 1, triggers: [cron('*/10 * * * *')] },
  async ({ step }) => {
    const sweptIds = await step.run('sweep', async () => {
      const admin = createAdminClient()
      const cutoff = new Date(Date.now() - STALE_AFTER_MS).toISOString()
      const { data, error } = await admin
        .from('generation_jobs')
        .update({
          status: 'failed',
          error: { code: 'internal_error', message: 'timed out' },
          finished_at: new Date().toISOString(),
        })
        .in('status', ['pending', 'running'])
        .lt('created_at', cutoff)
        .select('id')
      if (error) throw error
      return (data ?? []).map((r) => r.id as string)
    })

    if (sweptIds.length) {
      await step.sendEvent(
        'emit-failed',
        sweptIds.map((jobId) => generationFailed.create({ jobId })),
      )
    }
    return { swept: sweptIds.length }
  },
)
