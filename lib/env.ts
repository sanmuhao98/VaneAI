import { z } from 'zod'

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  NEXT_PUBLIC_SITE_URL: z.string().url(),

  ARK_API_KEY: z.string().min(1).optional(),
  FAL_API_KEY: z.string().min(1).optional(),
  INNGEST_EVENT_KEY: z.string().min(1).optional(),
  INNGEST_SIGNING_KEY: z.string().min(1).optional(),

  SENTRY_DSN: z.string().url().optional().or(z.literal('')),
  ADMIN_EMAILS: z.string().optional().default(''),
  DAILY_DEV_CALL_LIMIT: z.coerce.number().int().nonnegative().optional(),
})

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
})

function parse<T extends z.ZodTypeAny>(schema: T, source: Record<string, string | undefined>): z.infer<T> {
  const result = schema.safeParse(source)
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n')
    throw new Error(`Invalid environment variables:\n${issues}\n\nSee .env.example for the required keys.`)
  }
  return result.data
}

const isServer = typeof window === 'undefined'

// Public env — safe to read from anywhere (browser + server). Inlined by Next at build time.
export const clientEnv = parse(clientSchema, {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
})

// Server-only env — accessing on the client throws. Bundling via NEXT_PUBLIC_* is the only path
// to expose values to the browser, so non-public keys are guaranteed to stay server-side.
export const serverEnv = isServer
  ? parse(serverSchema, process.env)
  : (new Proxy({} as z.infer<typeof serverSchema>, {
      get(_t, prop) {
        throw new Error(
          `serverEnv.${String(prop)} is not accessible on the client. Use clientEnv (NEXT_PUBLIC_*) or move the call to the server.`,
        )
      },
    }))

export type ServerEnv = typeof serverEnv
export type ClientEnv = typeof clientEnv
