import { describe, it, expect } from 'vitest'
import { generateFeatureFilename, getTitleFromContent } from '../../src/shared/types'

// Fixed date injected into all filename tests: 2026-02-23 14:30:45
const D = new Date(2026, 1, 23, 14, 30, 45)

// ---------------------------------------------------------------------------
// generateFeatureFilename
// ---------------------------------------------------------------------------

describe('generateFeatureFilename', () => {
  describe('filename patterns', () => {
    it('name-date (default) produces <slug>-<date>', () => {
      expect(generateFeatureFilename('My Feature', 'name-date', D)).toBe('my-feature-2026-02-23')
    })

    it('date-name produces <date>-<slug>', () => {
      expect(generateFeatureFilename('My Feature', 'date-name', D)).toBe('2026-02-23-my-feature')
    })

    it('name-datetime produces <slug>-<date>-<time>', () => {
      expect(generateFeatureFilename('My Feature', 'name-datetime', D)).toBe('my-feature-2026-02-23-143045')
    })

    it('datetime-name produces <date>-<time>-<slug>', () => {
      expect(generateFeatureFilename('My Feature', 'datetime-name', D)).toBe('2026-02-23-143045-my-feature')
    })

    it('defaults to name-date when no pattern supplied', () => {
      expect(generateFeatureFilename('My Feature', undefined, D)).toBe('my-feature-2026-02-23')
    })
  })

  describe('slug generation', () => {
    it('lowercases the title', () => {
      expect(generateFeatureFilename('UPPER CASE', 'name-date', D)).toBe('upper-case-2026-02-23')
    })

    it('replaces spaces with hyphens', () => {
      expect(generateFeatureFilename('one two three', 'name-date', D)).toBe('one-two-three-2026-02-23')
    })

    it('strips special characters', () => {
      expect(generateFeatureFilename('Hello! @World#', 'name-date', D)).toBe('hello-world-2026-02-23')
    })

    it('collapses multiple consecutive hyphens to one', () => {
      expect(generateFeatureFilename('a  --  b', 'name-date', D)).toBe('a-b-2026-02-23')
    })

    it('trims leading and trailing hyphens from slug', () => {
      expect(generateFeatureFilename('!leading and trailing!', 'name-date', D)).toBe('leading-and-trailing-2026-02-23')
    })

    it('truncates slug at 50 characters', () => {
      const long = 'a'.repeat(60)
      const result = generateFeatureFilename(long, 'name-date', D)
      const slug = result.replace('-2026-02-23', '')
      expect(slug.length).toBe(50)
    })

    it('falls back to "feature" for an empty title', () => {
      expect(generateFeatureFilename('', 'name-date', D)).toBe('feature-2026-02-23')
    })

    it('falls back to "feature" when title contains only special chars', () => {
      expect(generateFeatureFilename('!@#$%', 'name-date', D)).toBe('feature-2026-02-23')
    })

    it('preserves hyphens already in title', () => {
      expect(generateFeatureFilename('my-existing-slug', 'name-date', D)).toBe('my-existing-slug-2026-02-23')
    })
  })

  describe('date formatting', () => {
    it('zero-pads single-digit months', () => {
      const jan = new Date(2026, 0, 5)
      expect(generateFeatureFilename('x', 'name-date', jan)).toBe('x-2026-01-05')
    })

    it('zero-pads single-digit days', () => {
      const d9 = new Date(2026, 0, 9)
      expect(generateFeatureFilename('x', 'name-date', d9)).toBe('x-2026-01-09')
    })

    it('zero-pads time components', () => {
      const early = new Date(2026, 0, 1, 1, 2, 3)
      expect(generateFeatureFilename('x', 'name-datetime', early)).toBe('x-2026-01-01-010203')
    })
  })
})

// ---------------------------------------------------------------------------
// getTitleFromContent
// ---------------------------------------------------------------------------

describe('getTitleFromContent', () => {
  it('extracts text from a top-level # heading', () => {
    expect(getTitleFromContent('# My Feature\n\nSome body.')).toBe('My Feature')
  })

  it('extracts # heading that appears mid-content', () => {
    expect(getTitleFromContent('Some intro\n# The Title\nMore text')).toBe('The Title')
  })

  it('trims whitespace from the heading text', () => {
    expect(getTitleFromContent('#   Spaces Around   ')).toBe('Spaces Around')
  })

  it('does not match ## or deeper headings — falls back to raw first line', () => {
    // No H1 present, so the fallback returns the first non-empty line verbatim
    expect(getTitleFromContent('## Secondary\nNext')).toBe('## Secondary')
    expect(getTitleFromContent('### Tertiary')).toBe('### Tertiary')
  })

  it('falls back to first non-empty line when there is no # heading', () => {
    expect(getTitleFromContent('Plain first line\nSecond line')).toBe('Plain first line')
  })

  it('skips blank lines when falling back to first non-empty line', () => {
    expect(getTitleFromContent('\n\nActual first line')).toBe('Actual first line')
  })

  it('returns "Untitled" for empty string', () => {
    expect(getTitleFromContent('')).toBe('Untitled')
  })

  it('returns "Untitled" for whitespace-only content', () => {
    expect(getTitleFromContent('   \n\n  ')).toBe('Untitled')
  })
})
