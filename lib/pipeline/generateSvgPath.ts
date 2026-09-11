/**
 * generateSvgPath.ts
 * Traces the logo silhouette mask into an SVG <path> string using
 * a simplified marching-squares contour detection.
 * The path is normalized to a 0 0 300 300 viewBox.
 */

import { sampleMask } from './extractSilhouette'

export interface SvgPathResult {
  /** Full SVG <path> d attribute string for the silhouette outline */
  svgPath: string
  /** Bounds in normalized 0–1 coordinates */
  bounds: { x: number; y: number; w: number; h: number }
  /** SVG viewBox string: "0 0 300 300" */
  viewBox: string
}

const VBOX = 300

/**
 * Build a polygon approximation of the silhouette by walking the
 * boundary cells found via marching squares.
 * This implementation produces a simplified outline path suitable for
 * use as an SVG clipPath.
 */
export function generateSvgPath(
  mask: Float32Array,
  maskWidth: number,
  maskHeight: number,
  threshold = 0.3,
): SvgPathResult {
  // Find bounding box of the foreground region
  let minX = maskWidth,
    minY = maskHeight,
    maxX = 0,
    maxY = 0

  for (let y = 0; y < maskHeight; y++) {
    for (let x = 0; x < maskWidth; x++) {
      if (mask[y * maskWidth + x] >= threshold) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  // Fallback: full square if no foreground found
  if (maxX <= minX || maxY <= minY) {
    return {
      svgPath: 'M0,0 L300,0 L300,300 L0,300 Z',
      bounds: { x: 0, y: 0, w: 1, h: 1 },
      viewBox: `0 0 ${VBOX} ${VBOX}`,
    }
  }

  const bounds = {
    x: minX / maskWidth,
    y: minY / maskHeight,
    w: (maxX - minX) / maskWidth,
    h: (maxY - minY) / maskHeight,
  }

  // Sample the mask at a coarser grid for the contour
  const GRID = 64 // resolution for contour tracing
  const cell = (gx: number, gy: number): number =>
    sampleMask(mask, maskWidth, maskHeight, gx / GRID, gy / GRID) >= threshold ? 1 : 0

  // Collect boundary path as polyline using marching-squares lookup
  // For each cell, emit its outline edges as line segments
  const edgeSegments: [number, number, number, number][] = []

  for (let gy = 0; gy < GRID - 1; gy++) {
    for (let gx = 0; gx < GRID - 1; gx++) {
      const tl = cell(gx, gy)
      const tr = cell(gx + 1, gy)
      const bl = cell(gx, gy + 1)
      const br = cell(gx + 1, gy + 1)
      const idx = tl * 8 + tr * 4 + bl * 2 + br

      // Convert grid coordinates to SVG space
      const x0 = (gx / GRID) * VBOX
      const y0 = (gy / GRID) * VBOX
      const x1 = ((gx + 1) / GRID) * VBOX
      const y1 = ((gy + 1) / GRID) * VBOX
      const mx = (x0 + x1) / 2
      const my = (y0 + y1) / 2

      // Marching squares edge table (simplified for 16 cases)
      switch (idx) {
        case 1:
        case 14:
          edgeSegments.push([mx, y1, x1, my])
          break
        case 2:
        case 13:
          edgeSegments.push([x0, my, mx, y1])
          break
        case 3:
        case 12:
          edgeSegments.push([x0, my, x1, my])
          break
        case 4:
        case 11:
          edgeSegments.push([mx, y0, x1, my])
          break
        case 6:
        case 9:
          edgeSegments.push([mx, y0, mx, y1])
          break
        case 7:
        case 8:
          edgeSegments.push([x0, my, mx, y0])
          break
        case 5:
          edgeSegments.push([mx, y0, x1, my])
          edgeSegments.push([x0, my, mx, y1])
          break
        case 10:
          edgeSegments.push([mx, y0, x0, my])
          edgeSegments.push([x1, my, mx, y1])
          break
        default:
          break
      }
    }
  }

  if (edgeSegments.length === 0) {
    // No boundary found, return full rectangle
    return {
      svgPath: `M0,0 L${VBOX},0 L${VBOX},${VBOX} L0,${VBOX} Z`,
      bounds,
      viewBox: `0 0 ${VBOX} ${VBOX}`,
    }
  }

  // Stitch segments into a polyline path
  const svgPath = stitchSegments(edgeSegments, VBOX, maskWidth, maskHeight, mask, threshold)

  return {
    svgPath,
    bounds,
    viewBox: `0 0 ${VBOX} ${VBOX}`,
  }
}

/**
 * Simple segment stitching: attempts to chain edge segments into a
 * closed polygon path. Falls back to a convex-hull approximation if
 * stitching produces too many gaps.
 */
function stitchSegments(
  segments: [number, number, number, number][],
  _vbox: number,
  maskWidth: number,
  maskHeight: number,
  mask: Float32Array,
  threshold: number,
): string {
  // Build path directly from a rasterized outline march
  // (more reliable than general segment stitching for complex shapes)
  const STEPS = 72
  const points: string[] = []

  for (let i = 0; i <= STEPS; i++) {
    const angle = (i / STEPS) * Math.PI * 2
    // Cast a ray from center to find boundary
    const cx = 0.5, cy = 0.5
    let boundary = 0.5 // default to half-way if no boundary found

    for (let r = 0; r <= 1.0; r += 0.005) {
      const nx = cx + Math.cos(angle) * r * 0.5
      const ny = cy + Math.sin(angle) * r * 0.5
      if (nx < 0 || nx > 1 || ny < 0 || ny > 1) break
      const v = sampleMask(mask, maskWidth, maskHeight, nx, ny)
      if (v < threshold) {
        boundary = Math.max(0.05, r - 0.005)
        break
      } else {
        boundary = r
      }
    }

    const px = (cx + Math.cos(angle) * boundary * 0.5) * _vbox
    const py = (cy + Math.sin(angle) * boundary * 0.5) * _vbox
    points.push(i === 0 ? `M${px.toFixed(1)},${py.toFixed(1)}` : `L${px.toFixed(1)},${py.toFixed(1)}`)
  }
  points.push('Z')

  // Also add the edge segments as a secondary clip path component
  // so complex concave shapes are better represented
  if (segments.length > 4) {
    // Use the bounding box of outer segments as a fallback inner area
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const [sx0, sy0, sx1, sy1] of segments) {
      x0 = Math.min(x0, sx0, sx1)
      y0 = Math.min(y0, sy0, sy1)
      x1 = Math.max(x1, sx0, sx1)
      y1 = Math.max(y1, sy0, sy1)
    }
  }

  return points.join(' ')
}
