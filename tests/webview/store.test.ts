import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '../../src/webview/store'
import type { Feature } from '../../src/shared/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const initialState = useStore.getState()

beforeEach(() => {
  useStore.setState(initialState, true)
})

function makeFeature(overrides: Partial<Feature> = {}): Feature {
  return {
    id: 'f1',
    status: 'todo',
    priority: 'medium',
    assignee: null,
    dueDate: null,
    created: '2026-01-01T00:00:00.000Z',
    modified: '2026-01-01T00:00:00.000Z',
    completedAt: null,
    labels: [],
    order: 'a0',
    content: '# Feature',
    filePath: '/workspace/features/feature.md',
    ...overrides
  }
}

// ---------------------------------------------------------------------------
// Feature mutations
// ---------------------------------------------------------------------------

describe('addFeature', () => {
  it('appends a feature to the list', () => {
    const f = makeFeature({ id: 'abc' })
    useStore.getState().addFeature(f)
    expect(useStore.getState().features).toHaveLength(1)
    expect(useStore.getState().features[0].id).toBe('abc')
  })
})

describe('removeFeature', () => {
  it('removes the feature with the given id', () => {
    useStore.getState().addFeature(makeFeature({ id: 'to-remove' }))
    useStore.getState().addFeature(makeFeature({ id: 'keep' }))
    useStore.getState().removeFeature('to-remove')
    const ids = useStore.getState().features.map(f => f.id)
    expect(ids).not.toContain('to-remove')
    expect(ids).toContain('keep')
  })
})

describe('updateFeature', () => {
  it('merges updates into the matching feature', () => {
    useStore.getState().addFeature(makeFeature({ id: 'u1', priority: 'low' }))
    useStore.getState().updateFeature('u1', { priority: 'critical' })
    expect(useStore.getState().features[0].priority).toBe('critical')
  })

  it('leaves other features untouched', () => {
    useStore.getState().addFeature(makeFeature({ id: 'a', status: 'todo' }))
    useStore.getState().addFeature(makeFeature({ id: 'b', status: 'done' }))
    useStore.getState().updateFeature('a', { status: 'in-progress' })
    expect(useStore.getState().features.find(f => f.id === 'b')!.status).toBe('done')
  })
})

// ---------------------------------------------------------------------------
// getFeaturesByStatus
// ---------------------------------------------------------------------------

describe('getFeaturesByStatus', () => {
  it('returns only features with the given status', () => {
    useStore.getState().addFeature(makeFeature({ id: '1', status: 'todo' }))
    useStore.getState().addFeature(makeFeature({ id: '2', status: 'done' }))
    useStore.getState().addFeature(makeFeature({ id: '3', status: 'todo' }))
    const results = useStore.getState().getFeaturesByStatus('todo')
    expect(results.map(f => f.id)).toEqual(expect.arrayContaining(['1', '3']))
    expect(results.some(f => f.id === '2')).toBe(false)
  })

  it('returns features sorted by order (lexicographic ascending)', () => {
    useStore.getState().addFeature(makeFeature({ id: 'c', status: 'todo', order: 'a2' }))
    useStore.getState().addFeature(makeFeature({ id: 'a', status: 'todo', order: 'a0' }))
    useStore.getState().addFeature(makeFeature({ id: 'b', status: 'todo', order: 'a1' }))
    const ids = useStore.getState().getFeaturesByStatus('todo').map(f => f.id)
    expect(ids).toEqual(['a', 'b', 'c'])
  })
})

// ---------------------------------------------------------------------------
// getFilteredFeaturesByStatus
// ---------------------------------------------------------------------------

describe('getFilteredFeaturesByStatus', () => {
  beforeEach(() => {
    useStore.getState().addFeature(makeFeature({ id: 'high', status: 'todo', priority: 'high', assignee: 'alice', labels: ['frontend'], order: 'a0' }))
    useStore.getState().addFeature(makeFeature({ id: 'low',  status: 'todo', priority: 'low',  assignee: 'bob',   labels: ['backend'],  order: 'a1' }))
    useStore.getState().addFeature(makeFeature({ id: 'done', status: 'done', priority: 'high', assignee: 'alice', labels: [],           order: 'a0' }))
  })

  it('returns all features for the status when no filters are active', () => {
    expect(useStore.getState().getFilteredFeaturesByStatus('todo')).toHaveLength(2)
  })

  it('filters by priority', () => {
    useStore.setState({ priorityFilter: 'high' })
    const results = useStore.getState().getFilteredFeaturesByStatus('todo')
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('high')
  })

  it('filters by assignee', () => {
    useStore.setState({ assigneeFilter: 'bob' })
    const results = useStore.getState().getFilteredFeaturesByStatus('todo')
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('low')
  })

  it('filters unassigned features', () => {
    useStore.getState().addFeature(makeFeature({ id: 'unassigned', status: 'todo', assignee: null, order: 'a2' }))
    useStore.setState({ assigneeFilter: 'unassigned' })
    const results = useStore.getState().getFilteredFeaturesByStatus('todo')
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('unassigned')
  })

  it('filters by label', () => {
    useStore.setState({ labelFilter: 'label:frontend' })
    const results = useStore.getState().getFilteredFeaturesByStatus('todo')
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('high')
  })

  it('filters unlabeled features', () => {
    useStore.getState().addFeature(makeFeature({ id: 'unlabeled', status: 'todo', labels: [], order: 'a3' }))
    useStore.setState({ labelFilter: 'unlabeled' })
    const results = useStore.getState().getFilteredFeaturesByStatus('todo')
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('unlabeled')
  })

  it('filters by search query against content', () => {
    useStore.getState().addFeature(makeFeature({ id: 'searchable', status: 'todo', content: '# Fix login bug', order: 'a4' }))
    useStore.setState({ searchQuery: 'login' })
    const results = useStore.getState().getFilteredFeaturesByStatus('todo')
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('searchable')
  })

  it('filters by search query against assignee', () => {
    useStore.setState({ searchQuery: 'alice' })
    const results = useStore.getState().getFilteredFeaturesByStatus('todo')
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('high')
  })

  it('filters out features without a due date when dueDateFilter is "no-date"', () => {
    useStore.getState().addFeature(makeFeature({ id: 'with-date', status: 'todo', dueDate: '2026-06-01', order: 'a5' }))
    useStore.setState({ dueDateFilter: 'no-date' })
    const ids = useStore.getState().getFilteredFeaturesByStatus('todo').map(f => f.id)
    expect(ids).not.toContain('with-date')
    expect(ids).toContain('high') // high has no due date
  })

  it('filters overdue features', () => {
    useStore.getState().addFeature(makeFeature({ id: 'overdue', status: 'todo', dueDate: '2020-01-01', order: 'a5' }))
    useStore.getState().addFeature(makeFeature({ id: 'future',  status: 'todo', dueDate: '2099-12-31', order: 'a6' }))
    useStore.setState({ dueDateFilter: 'overdue' })
    const ids = useStore.getState().getFilteredFeaturesByStatus('todo').map(f => f.id)
    expect(ids).toContain('overdue')
    expect(ids).not.toContain('future')
  })
})

// ---------------------------------------------------------------------------
// toggleColumnCollapsed
// ---------------------------------------------------------------------------

describe('toggleColumnCollapsed', () => {
  it('adds the column id when not yet collapsed', () => {
    useStore.getState().toggleColumnCollapsed('backlog')
    expect(useStore.getState().collapsedColumns.has('backlog')).toBe(true)
  })

  it('removes the column id when already collapsed', () => {
    useStore.getState().toggleColumnCollapsed('backlog')
    useStore.getState().toggleColumnCollapsed('backlog')
    expect(useStore.getState().collapsedColumns.has('backlog')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// clearAllFilters
// ---------------------------------------------------------------------------

describe('clearAllFilters', () => {
  it('resets all active filters to their defaults', () => {
    useStore.setState({ searchQuery: 'foo', priorityFilter: 'high', assigneeFilter: 'alice', labelFilter: 'label:frontend', dueDateFilter: 'overdue' })
    useStore.getState().clearAllFilters()
    const { searchQuery, priorityFilter, assigneeFilter, labelFilter, dueDateFilter } = useStore.getState()
    expect(searchQuery).toBe('')
    expect(priorityFilter).toBe('all')
    expect(assigneeFilter).toBe('all')
    expect(labelFilter).toBe('all')
    expect(dueDateFilter).toBe('all')
  })
})

// ---------------------------------------------------------------------------
// hasActiveFilters
// ---------------------------------------------------------------------------

describe('hasActiveFilters', () => {
  it('returns false when no filters are active', () => {
    expect(useStore.getState().hasActiveFilters()).toBe(false)
  })

  it('returns true when searchQuery is set', () => {
    useStore.setState({ searchQuery: 'x' })
    expect(useStore.getState().hasActiveFilters()).toBe(true)
  })

  it('returns true when priorityFilter is set', () => {
    useStore.setState({ priorityFilter: 'high' })
    expect(useStore.getState().hasActiveFilters()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getUniqueAssignees / getUniqueLabels
// ---------------------------------------------------------------------------

describe('getUniqueAssignees', () => {
  it('returns sorted unique assignees, ignoring nulls', () => {
    useStore.getState().addFeature(makeFeature({ id: '1', assignee: 'charlie' }))
    useStore.getState().addFeature(makeFeature({ id: '2', assignee: 'alice' }))
    useStore.getState().addFeature(makeFeature({ id: '3', assignee: 'alice' }))
    useStore.getState().addFeature(makeFeature({ id: '4', assignee: null }))
    expect(useStore.getState().getUniqueAssignees()).toEqual(['alice', 'charlie'])
  })
})

describe('getUniqueLabels', () => {
  it('returns sorted unique labels across all features', () => {
    useStore.getState().addFeature(makeFeature({ id: '1', labels: ['bug', 'frontend'] }))
    useStore.getState().addFeature(makeFeature({ id: '2', labels: ['frontend', 'ux'] }))
    expect(useStore.getState().getUniqueLabels()).toEqual(['bug', 'frontend', 'ux'])
  })
})
