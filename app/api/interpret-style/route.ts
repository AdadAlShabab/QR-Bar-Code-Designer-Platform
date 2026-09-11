import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'

const styleSchema = z.object({ palette: z.enum(['Emerald', 'Saffron', 'Ocean']), message: z.string().max(160) })

export async function POST(request: Request) {
  const { prompt } = await request.json()
  if (typeof prompt !== 'string' || !prompt.trim()) return Response.json({ message: 'Describe a style to get started.' }, { status: 400 })
  if (!process.env.GEMINI_API_KEY) return Response.json({ palette: 'Emerald', message: 'Style understood — using a high-contrast emerald palette.' })
  try {
    const { object } = await generateObject({ model: google('gemini-2.5-flash'), schema: styleSchema, system: 'You are a concise brand designer. Map a business design request to the closest palette. Always ensure QR readability.', prompt: prompt.slice(0, 300) })
    return Response.json(object)
  } catch { return Response.json({ palette: 'Emerald', message: 'Style understood — using a high-contrast emerald palette.' }) }
}
