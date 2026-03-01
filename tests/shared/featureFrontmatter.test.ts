import { describe, it, expect } from 'vitest'
import type { Feature } from '../../src/shared/types'
import { parseFeatureFile, serializeFeature } from '../../src/shared/featureFrontmatter'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FIXTURE_PATH = '/workspace/.devtool/features/my-feature-2026-02-23.md'

function makeFeature(overrides: Partial<Feature> = {}): Feature {
  return {
    id: 'abc-123',
    status: 'in-progress',
    priority: 'high',
    assignee: 'foo',
    dueDate: '2026-03-01',
    created: '2026-02-23T10:00:00.000Z',
    modified: '2026-02-24T12:00:00.000Z',
    completedAt: null,
    labels: ['frontend', 'bug'],
    order: 'a1',
    content: '# My Feature\n\nSome description.',
    filePath: FIXTURE_PATH,
    ...overrides
  }
}

function makeFrontmatter(overrides: Record<string, string> = {}): string {
  const fields: Record<string, string> = {
    id: '"abc-123"',
    status: '"in-progress"',
    priority: '"high"',
    assignee: '"foo"',
    dueDate: '"2026-03-01"',
    created: '"2026-02-23T10:00:00.000Z"',
    modified: '"2026-02-24T12:00:00.000Z"',
    completedAt: 'null',
    labels: '["frontend", "bug"]',
    order: '"a1"',
    ...overrides
  }
  const lines = Object.entries(fields).map(([k, v]) => `${k}: ${v}`)
  return `---\n${lines.join('\n')}\n---\n`
}

// ---------------------------------------------------------------------------
// parseFeatureFile
// ---------------------------------------------------------------------------

describe('parseFeatureFile', () => {
  it('parses a well-formed file into a Feature', () => {
    const content = makeFrontmatter() + '# My Feature\n\nSome description.'
    const feature = parseFeatureFile(content, FIXTURE_PATH)

    expect(feature).not.toBeNull()
    expect(feature!.id).toBe('abc-123')
    expect(feature!.status).toBe('in-progress')
    expect(feature!.priority).toBe('high')
    expect(feature!.assignee).toBe('foo')
    expect(feature!.dueDate).toBe('2026-03-01')
    expect(feature!.completedAt).toBeNull()
    expect(feature!.labels).toEqual(['frontend', 'bug'])
    expect(feature!.order).toBe('a1')
    expect(feature!.content).toBe('# My Feature\n\nSome description.')
    expect(feature!.filePath).toBe(FIXTURE_PATH)
  })

  it('returns null when there is no frontmatter block', () => {
    expect(parseFeatureFile('# Just a plain markdown file', FIXTURE_PATH)).toBeNull()
  })

  it('returns null for empty content', () => {
    expect(parseFeatureFile('', FIXTURE_PATH)).toBeNull()
  })

  it('normalises CRLF line endings before parsing', () => {
    const content = makeFrontmatter().replace(/\n/g, '\r\n') + '# Body'
    const feature = parseFeatureFile(content, FIXTURE_PATH)
    expect(feature).not.toBeNull()
    expect(feature!.id).toBe('abc-123')
  })

  describe('null / missing field handling', () => {
    it('returns null assignee when frontmatter value is null', () => {
      const content = makeFrontmatter({ assignee: 'null' }) + ''
      const feature = parseFeatureFile(content, FIXTURE_PATH)!
      expect(feature.assignee).toBeNull()
    })

    it('returns null dueDate when frontmatter value is null', () => {
      const content = makeFrontmatter({ dueDate: 'null' }) + ''
      expect(parseFeatureFile(content, FIXTURE_PATH)!.dueDate).toBeNull()
    })

    it('returns null completedAt when frontmatter value is null', () => {
      const content = makeFrontmatter({ completedAt: 'null' }) + ''
      expect(parseFeatureFile(content, FIXTURE_PATH)!.completedAt).toBeNull()
    })

    it('defaults status to "backlog" when missing', () => {
      const content = makeFrontmatter({ status: '""' }).replace('status: ""', '') + ''
      const feature = parseFeatureFile(content, FIXTURE_PATH)!
      expect(feature.status).toBe('backlog')
    })

    it('defaults priority to "medium" when missing', () => {
      const content = makeFrontmatter({ priority: '""' }).replace('priority: ""', '') + ''
      const feature = parseFeatureFile(content, FIXTURE_PATH)!
      expect(feature.priority).toBe('medium')
    })

    it('defaults order to "a0" when missing', () => {
      const content = makeFrontmatter({ order: '""' }).replace('order: ""', '') + ''
      const feature = parseFeatureFile(content, FIXTURE_PATH)!
      expect(feature.order).toBe('a0')
    })

    it('falls back to filename (without extension) as id when id is missing', () => {
      const content = makeFrontmatter({ id: '""' }).replace('id: ""', '') + ''
      const feature = parseFeatureFile(content, FIXTURE_PATH)!
      expect(feature.id).toBe('my-feature-2026-02-23')
    })
  })

  describe('labels array', () => {
    it('parses multiple labels', () => {
      const content = makeFrontmatter({ labels: '["alpha", "beta", "gamma"]' }) + ''
      expect(parseFeatureFile(content, FIXTURE_PATH)!.labels).toEqual(['alpha', 'beta', 'gamma'])
    })

    it('returns an empty array for empty labels', () => {
      const content = makeFrontmatter({ labels: '[]' }) + ''
      expect(parseFeatureFile(content, FIXTURE_PATH)!.labels).toEqual([])
    })

    it('strips surrounding quotes from label values', () => {
      const content = makeFrontmatter({ labels: '["with-quotes"]' }) + ''
      expect(parseFeatureFile(content, FIXTURE_PATH)!.labels).toEqual(['with-quotes'])
    })
  })

  describe('content body', () => {
    it('trims leading and trailing whitespace from body', () => {
      const content = makeFrontmatter() + '\n\n  # Heading  \n\n'
      expect(parseFeatureFile(content, FIXTURE_PATH)!.content).toBe('# Heading')
    })

    it('returns empty string when there is no body', () => {
      const content = makeFrontmatter()
      expect(parseFeatureFile(content, FIXTURE_PATH)!.content).toBe('')
    })
  })
})

// ---------------------------------------------------------------------------
// serializeFeature
// ---------------------------------------------------------------------------

describe('serializeFeature', () => {
  it('produces a string starting with ---', () => {
    expect(serializeFeature(makeFeature())).toMatch(/^---\n/)
  })

  it('writes null fields as literal null (not quoted "null")', () => {
    const output = serializeFeature(makeFeature({ assignee: null, dueDate: null, completedAt: null }))
    expect(output).toContain('assignee: null')
    expect(output).toContain('dueDate: null')
    expect(output).toContain('completedAt: null')
    expect(output).not.toContain('"null"')
  })

  it('writes string fields with double quotes', () => {
    const output = serializeFeature(makeFeature())
    expect(output).toContain('id: "abc-123"')
    expect(output).toContain('status: "in-progress"')
    expect(output).toContain('priority: "high"')
  })

  it('serializes labels as a bracketed list of quoted strings', () => {
    const output = serializeFeature(makeFeature({ labels: ['frontend', 'bug'] }))
    expect(output).toContain('labels: ["frontend", "bug"]')
  })

  it('serializes empty labels as []', () => {
    const output = serializeFeature(makeFeature({ labels: [] }))
    expect(output).toContain('labels: []')
  })

  it('appends content after the closing ---', () => {
    const feature = makeFeature({ content: '# Title\n\nBody text.' })
    const output = serializeFeature(feature)
    expect(output).toContain('---\n# Title\n\nBody text.')
  })
})

// ---------------------------------------------------------------------------
// Round-trip: serialize → parse → equals original
// ---------------------------------------------------------------------------

describe('round-trip: serializeFeature → parseFeatureFile', () => {
  it('recovers the original feature faithfully', () => {
    const original = makeFeature()
    const serialized = serializeFeature(original)
    const recovered = parseFeatureFile(serialized, original.filePath)

    expect(recovered).not.toBeNull()
    expect(recovered!.id).toBe(original.id)
    expect(recovered!.status).toBe(original.status)
    expect(recovered!.priority).toBe(original.priority)
    expect(recovered!.assignee).toBe(original.assignee)
    expect(recovered!.dueDate).toBe(original.dueDate)
    expect(recovered!.created).toBe(original.created)
    expect(recovered!.modified).toBe(original.modified)
    expect(recovered!.completedAt).toBe(original.completedAt)
    expect(recovered!.labels).toEqual(original.labels)
    expect(recovered!.order).toBe(original.order)
    expect(recovered!.content).toBe(original.content)
    expect(recovered!.filePath).toBe(original.filePath)
  })

  it('round-trips a feature with all nullable fields set to null', () => {
    const original = makeFeature({ assignee: null, dueDate: null, completedAt: null, labels: [] })
    const recovered = parseFeatureFile(serializeFeature(original), original.filePath)!

    expect(recovered.assignee).toBeNull()
    expect(recovered.dueDate).toBeNull()
    expect(recovered.completedAt).toBeNull()
    expect(recovered.labels).toEqual([])
  })

  it('round-trips a feature with completedAt set', () => {
    const original = makeFeature({ status: 'done', completedAt: '2026-02-28T18:00:00.000Z' })
    const recovered = parseFeatureFile(serializeFeature(original), original.filePath)!
    expect(recovered.completedAt).toBe('2026-02-28T18:00:00.000Z')
  })
})
