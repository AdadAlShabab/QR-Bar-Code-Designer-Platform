import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generations } from '@/lib/db/schema'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const format = body.format === 'barcode' ? 'barcode' : 'qr'
    const style = typeof body.style === 'string' ? body.style.slice(0, 30) : 'classic'
    const sessionId = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous'
    await db.insert(generations).values({ sessionId: sessionId.slice(0, 120), format, style, promptPresent: Boolean(body.promptPresent), logoPresent: Boolean(body.logoPresent) })
    return NextResponse.json({ ok: true })
  } catch { return NextResponse.json({ ok: false }, { status: 503 }) }
}
