import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { textToImage } from '@/inngest/functions/text-to-image'
import { refundOnFailure } from '@/inngest/functions/refund-on-failure'
import { sweepStaleJobs } from '@/inngest/functions/sweep-stale-jobs'
import { cleanupSoftDeleted } from '@/inngest/functions/cleanup-soft-deleted'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [textToImage, refundOnFailure, sweepStaleJobs, cleanupSoftDeleted],
})
