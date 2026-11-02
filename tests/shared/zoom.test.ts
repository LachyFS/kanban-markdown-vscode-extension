import { describe, expect, it } from 'vitest'
import { normalizeZoomLevel } from '../../src/shared/zoom'

describe('board zoom settings', () => {
  it('keeps valid zoom and clamps finite values to the supported range', () => {
    expect(normalizeZoomLevel(1.25)).toBe(1.25)
    expect(normalizeZoomLevel(0)).toBe(0.5)
    expect(normalizeZoomLevel(99)).toBe(3)
  })

  it('rejects nonnumeric settings before they can reach webview HTML or CSS', () => {
    for (const value of [undefined, null, NaN, Infinity, -Infinity, '1.5', {}, '</style><script>alert(1)</script>']) {
      expect(normalizeZoomLevel(value)).toBe(1)
    }
  })
})
