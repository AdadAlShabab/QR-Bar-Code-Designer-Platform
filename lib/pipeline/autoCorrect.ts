/**
 * autoCorrect.ts
 * Progressive auto-correction loop for QR code rendering.
 *
 * Strategy:
 * 1. Render with full logo influence (1.0)
 * 2. Validate with jsqr
 * 3. If fails: reduce influence by step and retry
 * 4. If all retries fail: render standard QR (influence = 0)
 * 5. Report the final influence level used
 */

'use client'

import {
  renderQRWithMask,
  renderQRStandard,
  type MaskRenderOptions,
  type RenderColors,
} from './renderQR'
import { validateQR } from './validateCode'

export interface AutoCorrectResult {
  /** Whether the final render passed validation */
  passed: boolean
  /** The logo influence level actually used (0.0–1.0) */
  finalInfluence: number
  /** Number of render attempts made */
  attempts: number
  /** Decoded QR content (if validation passed) */
  decoded?: string
}

const INFLUENCE_STEPS = [1.0, 0.7, 0.45, 0.2, 0]

/**
 * Attempts to render a logo-fused QR code and validates it.
 * Progressively reduces logo influence until the QR decodes successfully.
 *
 * @param canvas - Target canvas element
 * @param value  - QR data string
 * @param mask   - Logo silhouette mask (Float32Array)
 * @param maskW  - Mask width
 * @param maskH  - Mask height
 * @param colors - Palette colors
 * @param logo   - Optional center-logo data URL (used as final fallback)
 * @param maxAttempts - Maximum retries (default: all influence steps)
 */
export async function autoCorrectQR(
  canvas: HTMLCanvasElement,
  value: string,
  mask: Float32Array | null,
  maskW: number,
  maskH: number,
  colors: RenderColors,
  logo: string | null = null,
  maxAttempts = INFLUENCE_STEPS.length,
): Promise<AutoCorrectResult> {
  const steps = INFLUENCE_STEPS.slice(0, maxAttempts)

  for (let i = 0; i < steps.length; i++) {
    const influence = steps[i]

    if (influence === 0 || !mask) {
      // Final fallback: standard QR
      renderQRStandard(canvas, value, colors, logo)
    } else {
      const opts: MaskRenderOptions = {
        colors,
        logoInfluence: influence,
      }
      renderQRWithMask(canvas, value, mask, maskW, maskH, opts)
    }

    // Give the canvas a tick to finish rendering
    await new Promise<void>((r) => requestAnimationFrame(() => r()))

    const validation = await validateQR(canvas, value)

    if (validation.passed) {
      return {
        passed: true,
        finalInfluence: influence,
        attempts: i + 1,
        decoded: validation.decoded,
      }
    }
  }

  // Nothing worked — render clean standard QR as a guaranteed fallback
  renderQRStandard(canvas, value, colors, null)
  return {
    passed: false,
    finalInfluence: 0,
    attempts: steps.length,
  }
}
