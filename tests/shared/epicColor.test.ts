import { describe, it, expect } from 'vitest'
import { epicThemeFromName } from '../../src/shared/epicColor'

describe('epicThemeFromName', () => {
  it('returns the same colors for the same epic name', () => {
    const a = epicThemeFromName('Payments', false)
    const b = epicThemeFromName('Payments', false)
    expect(a).toEqual(b)
  })

  it('differs between epic names', () => {
    const a = epicThemeFromName('Alpha', false)
    const b = epicThemeFromName('Beta', false)
    expect(a.border).not.toBe(b.border)
  })

  it('trims whitespace for hashing', () => {
    expect(epicThemeFromName('  Foo  ', false)).toEqual(epicThemeFromName('Foo', false))
  })

  it('produces hsl strings', () => {
    const { border, foreground } = epicThemeFromName('My Epic', true)
    expect(border).toMatch(/^hsl\(\d+, \d+%?, \d+%?\)$/)
    expect(foreground).toMatch(/^hsl\(\d+, \d+%?, \d+%?\)$/)
  })
})
