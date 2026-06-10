import { cron } from 'inngest'
import { inngest } from '@/inngest/client'
import { createAdminClient } from '@/lib/supabase/admin'

const RETENTION_DAYS = 7

// Soft-deleted jobs keep their rows + storage for 7 days (docs/04), then are
// purged for real: storage objects first, then hard-delete (assets cascade).
export const cleanupSoftDeleted = inngest.createFunction(
  { id: 'cleanup-soft-deleted', retries: 1, triggers: [cron('0 4 * * *')] },
  async ({ step }) => {
    return step.run('cleanup', async () => {
      const admin = createAdminClient()
      const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 3600_000).toISOString()

      const { data: jobs, error: jErr } = await admin
        .from('generation_jobs')
        .select('id')
        .not('deleted_at', 'is', null)
        .lt('deleted_at', cutoff)
        .limit(200) // bounded batch per run; the daily cron drains the backlog
      if (jErr) throw jErr
      if (!jobs?.length) return { purged: 0, files: 0 }

      const jobIds = jobs.map((j) => j.id as string)
      const { data: assets, error: aErr } = await admin
        .from('assets')
        .select('storage_bucket, storage_path')
        .in('job_id', jobIds)
      if (aErr) throw aErr

      // Group by bucket — remove() is per-bucket.
      const byBucket = new Map<string, string[]>()
      for (const a of assets ?? []) {
        const list = byBucket.get(a.storage_bucket) ?? []
        list.push(a.storage_path)
        byBucket.set(a.storage_bucket, list)
      }
      let files = 0
      for (const [bucket, paths] of byBucket) {
        const { error: rmErr } = await admin.storage.from(bucket).remove(paths)
        if (rmErr) throw rmErr
        files += paths.length
      }

      // Hard delete; assets rows cascade via FK.
      const { error: delErr } = await admin.from('generation_jobs').delete().in('id', jobIds)
      if (delErr) throw delErr

      return { purged: jobIds.length, files }
    })
  },
)
