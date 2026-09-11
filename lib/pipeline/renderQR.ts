/**
 * renderQR.ts
 * Client-side QR and barcode canvas/SVG rendering with logo-silhouette fusion.
 *
 * Rendering modes:
 *  1. renderQRWithMask()  — logo mask modulates QR module opacity/size
 *  2. renderBarcodeWithClip() — SVG clipPath barcode (barkodstudio style)
 *  3. renderQRStandard()  — fallback, standard QR with optional center logo
 *  4. renderBarcodeStandard() — standard JsBarcode fallback
 */

'use client'

import QRCode from 'qrcode'
import JsBarcode from 'jsbarcode'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RenderColors {
  ink: string
  accent: string
  soft: string
}

export interface MaskRenderOptions {
  colors: RenderColors
  /** 0.0 = standard QR, 1.0 = full logo silhouette influence */
  logoInfluence: number
  moduleSize?: number
}

export interface BarcodeClipOptions {
  value: string
  colors: RenderColors
  svgPath: string
  viewBox: string
}

// ─── QR with Logo Mask ────────────────────────────────────────────────────────

/**
 * Renders a QR code where data modules are visually modulated by the logo mask.
 * - Finder patterns, timing strips, format info: always rendered at 100%
 * - Data modules: opacity and size scale with mask value at that module center
 * - Background in logo-shaped area: faded/absent to reveal the silhouette
 */
export function renderQRWithMask(
  canvas: HTMLCanvasElement,
  value: string,
  mask: Float32Array,
  maskWidth: number,
  maskHeight: number,
  options: MaskRenderOptions,
): void {
  const { colors, logoInfluence, moduleSize = 10 } = options
  const { ink, accent } = colors

  const qr = QRCode.create(value || 'https://example.com', { errorCorrectionLevel: 'H' })
  const modules = qr.modules.size
  const quiet = 28

  canvas.width = modules * moduleSize + quiet * 2
  canvas.height = canvas.width

  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Helper: is this (row, col) a finder-pattern cell?
  const isFinder = (r: number, c: number) =>
    (r < 7 && c < 7) ||
    (r < 7 && c >= modules - 7) ||
    (r >= modules - 7 && c < 7)

  // Helper: is this a timing pattern cell?
  const isTiming = (r: number, c: number) =>
    (r === 6 && c >= 8 && c <= modules - 8) ||
    (c === 6 && r >= 8 && r <= modules - 8)

  // Normalize mask coordinate to module center
  const maskAt = (r: number, c: number): number => {
    const nx = (c + 0.5) / modules
    const ny = (r + 0.5) / modules
    const mx = Math.max(0, Math.min(maskWidth - 1, Math.floor(nx * maskWidth)))
    const my = Math.max(0, Math.min(maskHeight - 1, Math.floor(ny * maskHeight)))
    return mask[my * maskWidth + mx]
  }

  // Draw data modules with mask modulation
  ctx.fillStyle = ink
  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      if (!qr.modules.get(r, c)) continue
      if (isFinder(r, c) || isTiming(r, c)) continue

      const x = quiet + c * moduleSize
      const y = quiet + r * moduleSize
      const mv = maskAt(r, c) // 0.0–1.0

      // Blend: base radius + mask influence
      const baseRadius = moduleSize * 0.22
      const influence = mv * logoInfluence
      // Alpha: high influence = more opaque
      const alpha = 0.3 + influence * 0.7
      // Size: reduce module in background areas when influence is high
      const shrink = logoInfluence > 0.3 ? (1 - influence) * 0.4 : 0
      const size = moduleSize * (0.85 - shrink)
      const radius = baseRadius + influence * moduleSize * 0.15
      const px = x + (moduleSize - size) / 2 + 0.5
      const py = y + (moduleSize - size) / 2 + 0.5

      ctx.globalAlpha = alpha
      ctx.beginPath()
      ctx.roundRect(px, py, size - 1, size - 1, radius)
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1

  // Draw finder patterns (always solid, always structured)
  drawFinderPatterns(ctx, modules, quiet, moduleSize, ink, accent)
}

/**
 * Draw the 3 finder patterns with solid ink + accent inner squares.
 */
function drawFinderPatterns(
  ctx: CanvasRenderingContext2D,
  modules: number,
  quiet: number,
  moduleSize: number,
  ink: string,
  accent: string,
) {
  const corners: [number, number][] = [
    [0, 0],
    [modules - 7, 0],
    [0, modules - 7],
  ]

  for (const [col, row] of corners) {
    const x = quiet + col * moduleSize
    const y = quiet + row * moduleSize
    const size = moduleSize * 7

    ctx.globalAlpha = 1

    // Outer square
    ctx.fillStyle = ink
    ctx.beginPath()
    ctx.roundRect(x, y, size, size, moduleSize * 1.25)
    ctx.fill()

    // White ring
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.roundRect(
      x + moduleSize,
      y + moduleSize,
      size - moduleSize * 2,
      size - moduleSize * 2,
      moduleSize,
    )
    ctx.fill()

    // Accent inner dot
    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.roundRect(
      x + moduleSize * 2.35,
      y + moduleSize * 2.35,
      moduleSize * 2.3,
      moduleSize * 2.3,
      moduleSize * 0.75,
    )
    ctx.fill()
  }
}

// ─── Standard QR (fallback) ───────────────────────────────────────────────────

/**
 * Renders a clean standard QR code — used when logo influence = 0 or validation fails.
 */
export function renderQRStandard(
  canvas: HTMLCanvasElement,
  value: string,
  colors: RenderColors,
  logo: string | null = null,
): void {
  const { ink, accent } = colors
  const qr = QRCode.create(value || 'https://example.com', { errorCorrectionLevel: 'H' })
  const modules = qr.modules.size
  const quiet = 28
  const moduleSize = 10

  canvas.width = modules * moduleSize + quiet * 2
  canvas.height = canvas.width

  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const isFinder = (r: number, c: number) =>
    (r < 7 && c < 7) ||
    (r < 7 && c >= modules - 7) ||
    (r >= modules - 7 && c < 7)

  ctx.fillStyle = ink
  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      if (!qr.modules.get(r, c) || isFinder(r, c)) continue
      const x = quiet + c * moduleSize
      const y = quiet + r * moduleSize
      const radius = moduleSize * 0.28
      ctx.beginPath()
      ctx.roundRect(x + 0.7, y + 0.7, moduleSize - 1.4, moduleSize - 1.4, radius)
      ctx.fill()
    }
  }

  drawFinderPatterns(ctx, modules, quiet, moduleSize, ink, accent)

  // Optional center logo
  if (logo) {
    const img = new Image()
    img.onload = () => {
      const logoSize = moduleSize * 9
      const lx = (canvas.width - logoSize) / 2
      const ly = (canvas.height - logoSize) / 2
      ctx.drawImage(img, lx, ly, logoSize, logoSize)
    }
    img.src = logo
  }
}

// ─── Barcode with SVG ClipPath ────────────────────────────────────────────────

/**
 * Renders an artistic barcode where bars are clipped to the logo silhouette.
 * Uses the barkodstudio technique: real barcode bars + SVG clipPath.
 *
 * Returns an SVG string. The caller may render it via an Image and draw to canvas,
 * or inject it directly into the DOM for SVG export.
 */
export function renderBarcodeWithClip(options: BarcodeClipOptions): string {
  const { value, colors, svgPath, viewBox } = options
  const { ink, accent } = colors

  // Compute barcode data using JsBarcode internally
  const tempCanvas = document.createElement('canvas')
  const isEan13 = /^\d{13}$/.test(value)
  const isEan8 = /^\d{8}$/.test(value)
  const format = isEan13 ? 'ean13' : isEan8 ? 'ean8' : 'CODE128'

  // JsBarcode populates a temp canvas so we can extract bar geometry
  JsBarcode(tempCanvas, value || '0000000000000', {
    format,
    width: 2.5,
    height: 200,
    margin: 0,
    lineColor: '#000000',
    background: '#ffffff',
    displayValue: false,
  })

  // Read back bars from the temp canvas
  const tCtx = tempCanvas.getContext('2d')!
  const imgData = tCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height)
  const bars = extractBarsFromCanvas(imgData, tempCanvas.width, tempCanvas.height)

  if (bars.length === 0) {
    // Fallback: generate a basic SVG from the viewBox
    return buildFallbackBarcodeSvg(value, format, colors, svgPath, viewBox)
  }

  // Scale bars to fit SVG viewBox (300×300 + 80 for text strip)
  const svgW = 300
  const svgH = 380
  const barAreaH = 300
  const stripH = 60
  const barScale = svgW / tempCanvas.width
  const barHeightSvg = barAreaH

  const clipId = `logo_clip_${Math.random().toString(36).slice(2, 8)}`

  // Build bar rects
  const barRects = bars
    .map(({ x, w }) => {
      const sx = x * barScale
      const sw = Math.max(0.5, w * barScale)
      return `<rect x="${sx.toFixed(2)}" y="0" width="${sw.toFixed(2)}" height="${barHeightSvg}" fill="${ink}"/>`
    })
    .join('\n')

  // Number text (always outside clip zone, safe for scanning)
  const displayText = getDisplayText(value, format)
  const textBlock = buildTextBlock(displayText, format, svgW, barAreaH, stripH, accent)

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}" shape-rendering="crispEdges">
  <defs>
    <clipPath id="${clipId}">
      <path d="${svgPath}" transform="scale(${(svgW / 300).toFixed(4)},${(barAreaH / 300).toFixed(4)})" fill-rule="evenodd" clip-rule="evenodd"/>
      <rect x="0" y="${barAreaH}" width="${svgW}" height="${stripH + 20}"/>
    </clipPath>
  </defs>
  <rect width="${svgW}" height="${svgH}" fill="white"/>
  <g clip-path="url(#${clipId})">
${barRects}
  </g>
  ${textBlock}
</svg>`
}

/** Extract bar positions from a JsBarcode-rendered canvas */
function extractBarsFromCanvas(
  imgData: ImageData,
  width: number,
  height: number,
): { x: number; w: number }[] {
  const midY = Math.floor(height / 2)
  const bars: { x: number; w: number }[] = []
  let inBar = false
  let barStart = 0

  for (let x = 0; x < width; x++) {
    const idx = (midY * width + x) * 4
    const brightness = (imgData.data[idx] + imgData.data[idx + 1] + imgData.data[idx + 2]) / 3
    const isDark = brightness < 128

    if (isDark && !inBar) {
      inBar = true
      barStart = x
    } else if (!isDark && inBar) {
      inBar = false
      bars.push({ x: barStart, w: x - barStart })
    }
  }
  if (inBar) bars.push({ x: barStart, w: width - barStart })

  return bars
}

/** Get formatted display text for barcode */
function getDisplayText(value: string, format: string): string {
  if (format === 'ean13' && value.length >= 13) {
    return `${value[0]}  ${value.slice(1, 7)}  ${value.slice(7)}`
  }
  if (format === 'ean8' && value.length >= 8) {
    return `${value.slice(0, 4)}  ${value.slice(4)}`
  }
  return value
}

/** Build SVG text block for the barcode number strip */
function buildTextBlock(
  text: string,
  format: string,
  svgW: number,
  yBase: number,
  _stripH: number,
  accent: string,
): string {
  if (format === 'CODE128') {
    return `<text x="${svgW / 2}" y="${yBase + 35}" font-family="Roboto Mono,monospace" font-size="20" font-weight="700" text-anchor="middle" fill="${accent}">${text}</text>`
  }
  // EAN-13 / EAN-8 split text
  const parts = text.split('  ')
  if (parts.length >= 3) {
    return `
    <text x="4" y="${yBase + 38}" font-family="Roboto Mono,monospace" font-size="18" font-weight="700" fill="${accent}">${parts[0]}</text>
    <text x="${svgW * 0.29}" y="${yBase + 38}" font-family="Roboto Mono,monospace" font-size="18" font-weight="700" text-anchor="middle" fill="${accent}">${parts[1]}</text>
    <text x="${svgW * 0.73}" y="${yBase + 38}" font-family="Roboto Mono,monospace" font-size="18" font-weight="700" text-anchor="middle" fill="${accent}">${parts[2]}</text>`
  }
  return `<text x="${svgW / 2}" y="${yBase + 38}" font-family="Roboto Mono,monospace" font-size="18" font-weight="700" text-anchor="middle" fill="${accent}">${text}</text>`
}

/** Fallback SVG barcode using JsBarcode's raw output embedded inline */
function buildFallbackBarcodeSvg(
  value: string,
  format: string,
  colors: RenderColors,
  svgPath: string,
  _viewBox: string,
): string {
  const svgW = 300
  const svgH = 380
  const clipId = `fb_clip_${Math.random().toString(36).slice(2, 8)}`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}">
  <defs>
    <clipPath id="${clipId}">
      <path d="${svgPath}" fill-rule="evenodd"/>
    </clipPath>
  </defs>
  <rect width="${svgW}" height="${svgH}" fill="white"/>
  <text x="${svgW / 2}" y="${svgH - 20}" font-family="monospace" font-size="18" text-anchor="middle" fill="${colors.ink}">${value}</text>
</svg>`
}

// ─── Standard Barcode (fallback) ──────────────────────────────────────────────

/** Renders a standard JsBarcode barcode to canvas (no logo influence). */
export function renderBarcodeStandard(
  canvas: HTMLCanvasElement,
  value: string,
  colors: RenderColors,
): void {
  const { ink } = colors
  const isEan13 = /^\d{13}$/.test(value)
  const isEan8 = /^\d{8}$/.test(value)
  const format = isEan13 ? 'ean13' : isEan8 ? 'ean8' : 'CODE128'
  JsBarcode(canvas, value || '8901234567890', {
    format,
    width: 2.2,
    height: 150,
    margin: 18,
    lineColor: ink,
    background: '#ffffff',
    displayValue: true,
    fontSize: 16,
  })
}
