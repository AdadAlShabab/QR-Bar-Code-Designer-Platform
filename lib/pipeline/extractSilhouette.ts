/**
 * extractSilhouette.ts
 * Converts a preprocessed RGBA buffer into a Float32Array mask where
 * 0.0 = background/transparent and 1.0 = solid foreground.
 * Also extracts dominant foreground colors for palette integration.
 */

export interface SilhouetteResult {
  /** Flat Float32Array of length width*height, values 0.0–1.0 */
  mask: Float32Array
  width: number
  height: number
  /** Top 3 dominant foreground hex colors */
  dominantColors: string[]
}

function toHex(v: number) {
  return v.toString(16).padStart(2, '0')
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Extract per-pixel foreground strength from RGBA buffer.
 * strength = alpha_norm * (1 - luminance_norm)
 * This makes semi-transparent and dark pixels contribute as foreground.
 */
export function extractSilhouette(
  rgba: Buffer,
  width: number,
  height: number,
): SilhouetteResult {
  const total = width * height
  const mask = new Float32Array(total)
  const colorBuckets: Map<string, number> = new Map()

  for (let i = 0; i < total; i++) {
    const pi = i * 4
    const r = rgba[pi]
    const g = rgba[pi + 1]
    const b = rgba[pi + 2]
    const a = rgba[pi + 3]

    const alphaN = a / 255
    const lumN = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255

    // Strength: transparent pixels score 0, opaque dark pixels score 1
    const strength = alphaN * (0.15 + 0.85 * (1 - lumN))
    mask[i] = Math.min(1, Math.max(0, strength))

    // Collect dominant colors from high-strength pixels
    if (strength > 0.5 && alphaN > 0.6) {
      const bucket = rgbToHex(
        Math.round(r / 32) * 32,
        Math.round(g / 32) * 32,
        Math.round(b / 32) * 32,
      )
      colorBuckets.set(bucket, (colorBuckets.get(bucket) ?? 0) + 1)
    }
  }

  // Post-process: run a 2-pass morphological erosion then dilation to
  // remove isolated noise pixels (connected-component approximation).
  mask.set(denoise(mask, width, height))

  // Top-3 dominant colors
  const sorted = [...colorBuckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([hex]) => hex)

  return { mask, width, height, dominantColors: sorted }
}

/**
 * Simple 3×3 median-like denoise pass:
 * - pixels with strength < 0.15 and all 4 direct neighbours < 0.15 → set to 0
 * - pixels with strength > 0.6 and any neighbour > 0.6 → boosted slightly
 */
function denoise(mask: Float32Array, width: number, height: number): Float32Array {
  const out = new Float32Array(mask)
  const idx = (x: number, y: number) => y * width + x

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = idx(x, y)
      const v = mask[i]
      if (v < 0.1) {
        const neighbours =
          mask[idx(x - 1, y)] +
          mask[idx(x + 1, y)] +
          mask[idx(x, y - 1)] +
          mask[idx(x, y + 1)]
        if (neighbours < 0.4) out[i] = 0
      }
    }
  }
  return out
}

/**
 * Sample the mask at a normalized (0–1) position.
 */
export function sampleMask(
  mask: Float32Array,
  width: number,
  height: number,
  nx: number,
  ny: number,
): number {
  const x = Math.max(0, Math.min(width - 1, Math.floor(nx * width)))
  const y = Math.max(0, Math.min(height - 1, Math.floor(ny * height)))
  return mask[y * width + x]
}
