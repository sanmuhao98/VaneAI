// Provide placeholder env so lib/env.ts passes Zod validation when imported under vitest.
process.env.NEXT_PUBLIC_SITE_URL ??= 'http://localhost:3000'
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://127.0.0.1:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key'
