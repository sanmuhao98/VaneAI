import { Inngest, eventType } from 'inngest'
import { z } from 'zod'

// Typed events (Inngest v4): used as function triggers AND to create sends.
export const generationCreated = eventType('generation/created', {
  schema: z.object({ jobId: z.string().uuid() }),
})

// Emitted whenever a job lands in `failed` (worker or stale sweep) → triggers refund.
export const generationFailed = eventType('generation/failed', {
  schema: z.object({ jobId: z.string().uuid() }),
})

// In dev (NODE_ENV !== 'production') the SDK auto-connects to the local
// `npx inngest-cli dev` server — no keys needed. Production uses
// INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY from the environment.
export const inngest = new Inngest({ id: 'vaneai' })
