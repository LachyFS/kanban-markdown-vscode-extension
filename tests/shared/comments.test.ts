import { describe, it, expect } from 'vitest'
import {
  ensureCommentsSection,
  splitComments,
  withComments,
  buildCommentsSection,
  hasCommentsSection,
  type TaskComment
} from '../../src/shared/comments'

const SAMPLE_COMMENTS: TaskComment[] = [
  { dateTime: '2026-08-24T10:00:00.000Z', content: 'First comment', author: 'bob' },
  { dateTime: '2026-08-24T11:00:00.000Z', content: 'Second comment', author: 'alice' }
]

describe('ensureCommentsSection', () => {
  it('appends an empty comments table to content without one', () => {
    const result = ensureCommentsSection('# My Task\n\nSome description')
    expect(result).toBe(
      '# My Task\n\nSome description\n\n## Comments\n\n| Date Time | Content | Author |\n|-----------|---------|--------|\n'
    )
  })

  it('is idempotent when the section already exists', () => {
    const once = ensureCommentsSection('# My Task')
    expect(ensureCommentsSection(once)).toBe(once)
  })
})

describe('splitComments', () => {
  it('returns the full content as body when no section exists', () => {
    const { body, comments, hasSection } = splitComments('# Task\n\nbody text')
    expect(body).toBe('# Task\n\nbody text')
    expect(comments).toEqual([])
    expect(hasSection).toBe(false)
  })

  it('parses comment rows and strips the section from the body', () => {
    const content = `# Task\n\nbody text\n\n${buildCommentsSection(SAMPLE_COMMENTS)}\n`
    const { body, comments, hasSection } = splitComments(content)
    expect(body).toBe('# Task\n\nbody text')
    expect(comments).toEqual(SAMPLE_COMMENTS)
    expect(hasSection).toBe(true)
  })

  it('preserves non-table content written after the section', () => {
    const content = `# Task\n\nbody\n\n${buildCommentsSection(SAMPLE_COMMENTS)}\n\nextra notes\n`
    const { body, comments } = splitComments(content)
    expect(comments).toEqual(SAMPLE_COMMENTS)
    expect(body).toContain('extra notes')
    expect(body).toContain('body')
  })

  it('handles an empty comments table', () => {
    const { body, comments, hasSection } = splitComments(ensureCommentsSection('# Task'))
    expect(body).toBe('# Task')
    expect(comments).toEqual([])
    expect(hasSection).toBe(true)
  })
})

describe('withComments', () => {
  it('round-trips through splitComments', () => {
    const full = withComments('# Task\n\nbody', SAMPLE_COMMENTS)
    const { body, comments } = splitComments(full)
    expect(body).toBe('# Task\n\nbody')
    expect(comments).toEqual(SAMPLE_COMMENTS)
  })

  it('escapes pipe characters in cells', () => {
    const full = withComments('body', [
      { dateTime: '2026-08-24T10:00:00.000Z', content: 'a | b', author: 'bob' }
    ])
    const { comments } = splitComments(full)
    expect(comments[0].content).toBe('a | b')
  })
})

describe('hasCommentsSection', () => {
  it('does not match headings of other levels or text mentions', () => {
    expect(hasCommentsSection('### Comments')).toBe(false)
    expect(hasCommentsSection('## Comments')).toBe(true)
  })
})
