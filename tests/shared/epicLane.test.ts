import { describe, it, expect } from 'vitest'
import type { Feature } from '../../src/shared/types'
import { featureMatchesEpicLane } from '../../src/shared/epicLane'

function f(overrides: Partial<Feature>): Feature {
  return {
    id: 'x',
    status: 'todo',
    priority: 'medium',
    assignee: null,
    epic: null,
    dueDate: null,
    created: '',
    modified: '',
    completedAt: null,
    labels: [],
    order: 'a0',
    content: '# T',
    filePath: '/f.md',
    ...overrides
  }
}

describe('featureMatchesEpicLane', () => {
  it('matches all when epicLane is undefined', () => {
    expect(featureMatchesEpicLane(f({ epic: 'A' }), undefined)).toBe(true)
    expect(featureMatchesEpicLane(f({ epic: null }), undefined)).toBe(true)
  })

  it('null lane matches only tickets with no epic', () => {
    expect(featureMatchesEpicLane(f({ epic: null }), null)).toBe(true)
    expect(featureMatchesEpicLane(f({ epic: '  ' }), null)).toBe(true)
    expect(featureMatchesEpicLane(f({ epic: 'X' }), null)).toBe(false)
  })

  it('named lane matches that epic only', () => {
    expect(featureMatchesEpicLane(f({ epic: 'Foo' }), 'Foo')).toBe(true)
    expect(featureMatchesEpicLane(f({ epic: 'Bar' }), 'Foo')).toBe(false)
  })
})
