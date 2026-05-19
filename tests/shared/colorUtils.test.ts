import { describe, it, expect } from 'vitest'
import { fnv1aHash32, hsl } from '../../src/shared/colorUtils'

describe('fnv1aHash32', () => {
  it('is deterministic for the same input', () => {
    expect(fnv1aHash32('Epic Alpha')).toBe(fnv1aHash32('Epic Alpha'))
  })

  it('produces different values for different input', () => {
    expect(fnv1aHash32('Epic Alpha')).not.toBe(fnv1aHash32('Epic Beta'))
  })
})

describe('hsl', () => {
  it('formats hsl values consistently', () => {
    expect(hsl(120, 55, 40)).toBe('hsl(120, 55%, 40%)')
  })
})
