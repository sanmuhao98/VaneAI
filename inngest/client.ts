import { Inngest, eventType } from 'inngest'
import { z } from 'zod'

// Typed event (Inngest v4): used as the function trigger AND to create sends.
export const generationCreated = eventType('generation/created', {
  schema: z.object({ jobId: z.string().uuid() }),
})

// In dev (NODE_ENV !== 'production') the SDK auto-connects to the local
// `npx inngest-cli dev` server — no keys needed. Production uses
// INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY from the environment.
export const inngest = new Inngest({ id: 'vaneai' })
