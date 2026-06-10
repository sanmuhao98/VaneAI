import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { textToImage } from '@/inngest/functions/text-to-image'

export const { GET, POST, PUT } = serve({ client: inngest, functions: [textToImage] })
