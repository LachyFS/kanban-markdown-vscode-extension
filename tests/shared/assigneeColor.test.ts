import { describe, it, expect } from 'vitest'
import { assigneeThemeFromName } from '../../src/shared/assigneeColor'

describe('assigneeThemeFromName', () => {
  it('returns the same colors for the same assignee name', () => {
    const a = assigneeThemeFromName('Jane Doe', false)
    const b = assigneeThemeFromName('Jane Doe', false)
    expect(a).toEqual(b)
  })

  it('differs between assignee names', () => {
    const a = assigneeThemeFromName('Alice', false)
    const b = assigneeThemeFromName('Bob', false)
    expect(a.badgeBackground).not.toBe(b.badgeBackground)
  })

  it('normalizes casing and whitespace for hashing', () => {
    expect(assigneeThemeFromName('  Jane DOE  ', true)).toEqual(assigneeThemeFromName('jane doe', true))
  })

  it('produces hsl strings', () => {
    const colors = assigneeThemeFromName('My Assignee', true)
    expect(colors.badgeBackground).toMatch(/^hsl\(\d+, \d+%?, \d+%?\)$/)
    expect(colors.badgeForeground).toMatch(/^hsl\(\d+, \d+%?, \d+%?\)$/)
    expect(colors.nameForeground).toMatch(/^hsl\(\d+, \d+%?, \d+%?\)$/)
  })
})
