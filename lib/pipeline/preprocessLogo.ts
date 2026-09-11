/**
 * preprocessLogo.ts
 * Server-side logo preprocessing using Sharp.
 * Pipeline: accept Buffer → detect alpha or remove BG → normalize → return RGBA Buffer.
 */

import sharp from 'sharp'

export interface PreprocessResult {
  rgba: Buffer
  width: number
  height: number
  hasAlpha: boolean
  originalFormat: string
}

const NORMALIZED_SIZE = 256

/**
 * Samples the four corners of an image and returns the most-common color
 * as an {r,g,b} triple (flood-fill seed for background removal).
 */
function sampleCornerBackground(
  pixels: Buffer,
  width: number,
  height: number,
): { r: number; g: number; b: number } {
  const idx = (x: number, y: number) => (y * width + x) * 4
  const corners = [
    idx(0, 0),
    idx(width - 1, 0),
    idx(0, height - 1),
    idx(width - 1, height - 1),
  ]
  let r = 0, g = 0, b = 0
  for (const i of corners) {
    r += pixels[i]
    g += pixels[i + 1]
    b += pixels[i + 2]
  }
  return { r: Math.round(r / 4), g: Math.round(g / 4), b: Math.round(b / 4) }
}

/**
 * Iterative flood-fill BFS that marks background pixels transparent.
 * Starts from all 4 edges and fills pixels within `tolerance` distance
 * of the seed background color.
 */
function floodFillRemoveBackground(
  pixels: Buffer,
  width: number,
  height: number,
  bg: { r: number; g: number; b: number },
  tolerance = 32,
): Buffer {
  const result = Buffer.from(pixels)
  const visited = new Uint8Array(width * height)
  const queue: number[] = []

  const colorDist = (i: number) => {
    const r = result[i] - bg.r
    const g = result[i + 1] - bg.g
    const b = result[i + 2] - bg.b
    return Math.sqrt(r * r + g * g + b * b)
  }

  // Seed from all edge pixels
  for (let x = 0; x < width; x++) {
    queue.push(x, 0) // top row
    queue.push(x, height - 1) // bottom row
  }
  for (let y = 1; y < height - 1; y++) {
    queue.push(0, y) // left col
    queue.push(width - 1, y) // right col
  }

  while (queue.length > 0) {
    const y = queue.pop()!
    const x = queue.pop()!
    const flat = y * width + x
    if (visited[flat]) continue
    visited[flat] = 1
    const pi = flat * 4
    if (colorDist(pi) > tolerance) continue
    // Mark transparent
    result[pi + 3] = 0

    // Push neighbors
    if (x > 0) queue.push(x - 1, y)
    if (x < width - 1) queue.push(x + 1, y)
    if (y > 0) queue.push(x, y - 1)
    if (y < height - 1) queue.push(x, y + 1)
  }

  return result
}

/**
 * Main entry point.
 * - SVG is rasterized first.
 * - If the image already has an alpha channel, it is used as-is.
 * - Otherwise, corner-sampling flood-fill removes the background.
 * Output is always a 256×256 RGBA PNG Buffer.
 */
export async function preprocessLogo(
  input: Buffer,
  mimeType: string,
): Promise<PreprocessResult> {
  // Rasterize SVG
  let workingBuffer = input
  let originalFormat = mimeType
  if (mimeType === 'image/svg+xml') {
    workingBuffer = await sharp(input, { density: 192 })
      .resize(NORMALIZED_SIZE, NORMALIZED_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
    originalFormat = 'image/png'
  }

  // Get metadata to detect alpha
  const metadata = await sharp(workingBuffer).metadata()
  const hasNativeAlpha =
    metadata.channels === 4 ||
    metadata.hasAlpha === true

  if (hasNativeAlpha) {
    // Use the alpha channel directly — no BG removal needed
    const { data, info } = await sharp(workingBuffer)
      .resize(NORMALIZED_SIZE, NORMALIZED_SIZE, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    return {
      rgba: data,
      width: info.width,
      height: info.height,
      hasAlpha: true,
      originalFormat,
    }
  }

  // No alpha — resize first, then remove BG via flood-fill
  const { data: rawPixels, info } = await sharp(workingBuffer)
    .resize(NORMALIZED_SIZE, NORMALIZED_SIZE, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255 },
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const bg = sampleCornerBackground(rawPixels, info.width, info.height)
  const cleaned = floodFillRemoveBackground(rawPixels, info.width, info.height, bg, 32)

  return {
    rgba: cleaned,
    width: info.width,
    height: info.height,
    hasAlpha: false,
    originalFormat,
  }
}
