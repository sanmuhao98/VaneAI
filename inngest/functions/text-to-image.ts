import { generationCreated, inngest } from '@/inngest/client'
import { executeGenerationJob } from '@/lib/generation/execute-job'

// retries: 0 — executeGenerationJob marks the job failed itself and resolves.
// Blind retries would re-bill paid provider calls; refund-on-failure is W4.
export const textToImage = inngest.createFunction(
  { id: 'text-to-image', retries: 0, concurrency: { limit: 5 }, triggers: [generationCreated] },
  async ({ event, step }) => {
    return step.run('execute', () => executeGenerationJob(event.data.jobId))
  },
)
