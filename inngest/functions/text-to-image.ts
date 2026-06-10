import { generationCreated, generationFailed, inngest } from '@/inngest/client'
import { executeGenerationJob } from '@/lib/generation/execute-job'

// retries: 0 — executeGenerationJob marks the job failed itself and resolves.
// Blind retries would re-bill paid provider calls; refund-on-failure compensates instead.
export const textToImage = inngest.createFunction(
  { id: 'text-to-image', retries: 0, concurrency: { limit: 5 }, triggers: [generationCreated] },
  async ({ event, step }) => {
    const result = await step.run('execute', () => executeGenerationJob(event.data.jobId))
    if (result.status === 'failed') {
      await step.sendEvent('emit-failed', generationFailed.create({ jobId: event.data.jobId }))
    }
    return result
  },
)
