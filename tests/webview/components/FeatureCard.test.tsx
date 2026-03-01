// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FeatureCard } from '../../../src/webview/components/FeatureCard'
import { useStore } from '../../../src/webview/store'
import type { Feature, CardDisplaySettings } from '../../../src/shared/types'

// ---------------------------------------------------------------------------
// Store reset
// ---------------------------------------------------------------------------

const initialState = useStore.getState()

beforeEach(() => {
  useStore.setState(initialState, true)
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultSettings: CardDisplaySettings = {
  showPriorityBadges: true,
  showAssignee: true,
  showDueDate: true,
  showLabels: true,
  showBuildWithAI: true,
  showFileName: false,
  compactMode: false,
  markdownEditorMode: false,
  defaultPriority: 'medium',
  defaultStatus: 'backlog'
}

function setSettings(overrides: Partial<CardDisplaySettings> = {}) {
  useStore.setState({ cardSettings: { ...defaultSettings, ...overrides } })
}

function makeFeature(overrides: Partial<Feature> = {}): Feature {
  return {
    id: 'card-1',
    status: 'todo',
    priority: 'high',
    assignee: 'lucio',
    dueDate: null,
    created: '2026-01-01T00:00:00.000Z',
    modified: '2026-01-01T00:00:00.000Z',
    completedAt: null,
    labels: ['frontend', 'bug'],
    order: 'a0',
    content: '# My Feature\n\nA short description.',
    filePath: '/workspace/features/my-feature-2026-01-01.md',
    ...overrides
  }
}

// ---------------------------------------------------------------------------
// Title
// ---------------------------------------------------------------------------

describe('FeatureCard — title', () => {
  it('renders the title from the first # heading in content', () => {
    setSettings()
    render(<FeatureCard feature={makeFeature()} onClick={() => {}} />)
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('My Feature')
  })

  it('falls back to the first line when there is no # heading', () => {
    setSettings()
    render(<FeatureCard feature={makeFeature({ content: 'Plain title line' })} onClick={() => {}} />)
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Plain title line')
  })
})

// ---------------------------------------------------------------------------
// Priority badge
// ---------------------------------------------------------------------------

describe('FeatureCard — priority badge', () => {
  it('shows the priority badge when showPriorityBadges is true', () => {
    setSettings({ showPriorityBadges: true, showFileName: false })
    render(<FeatureCard feature={makeFeature({ priority: 'high' })} onClick={() => {}} />)
    expect(screen.getByText('High')).toBeInTheDocument()
  })

  it('hides the priority badge when showPriorityBadges is false', () => {
    setSettings({ showPriorityBadges: false })
    render(<FeatureCard feature={makeFeature({ priority: 'high' })} onClick={() => {}} />)
    expect(screen.queryByText('High')).not.toBeInTheDocument()
  })

  it('shows correct label for each priority level', () => {
    for (const [priority, label] of [['critical', 'Critical'], ['high', 'High'], ['medium', 'Med'], ['low', 'Low']] as const) {
      setSettings({ showPriorityBadges: true })
      const { unmount } = render(<FeatureCard feature={makeFeature({ priority })} onClick={() => {}} />)
      expect(screen.getByText(label)).toBeInTheDocument()
      unmount()
    }
  })
})

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

describe('FeatureCard — labels', () => {
  it('renders each label when showLabels is true', () => {
    setSettings({ showLabels: true })
    render(<FeatureCard feature={makeFeature({ labels: ['frontend', 'bug'] })} onClick={() => {}} />)
    expect(screen.getByText('frontend')).toBeInTheDocument()
    expect(screen.getByText('bug')).toBeInTheDocument()
  })

  it('hides labels when showLabels is false', () => {
    setSettings({ showLabels: false })
    render(<FeatureCard feature={makeFeature({ labels: ['frontend'] })} onClick={() => {}} />)
    expect(screen.queryByText('frontend')).not.toBeInTheDocument()
  })

  it('shows nothing extra when the labels array is empty and showLabels is true', () => {
    setSettings({ showLabels: true })
    render(<FeatureCard feature={makeFeature({ labels: [] })} onClick={() => {}} />)
    // just verify it doesn't throw and title still renders
    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument()
  })

  it('caps displayed labels at 3 and shows a "+N" overflow indicator', () => {
    setSettings({ showLabels: true })
    render(<FeatureCard feature={makeFeature({ labels: ['a', 'b', 'c', 'd'] })} onClick={() => {}} />)
    expect(screen.getByText('a')).toBeInTheDocument()
    expect(screen.getByText('b')).toBeInTheDocument()
    expect(screen.getByText('c')).toBeInTheDocument()
    expect(screen.queryByText('d')).not.toBeInTheDocument()
    expect(screen.getByText('+1')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Assignee
// ---------------------------------------------------------------------------

describe('FeatureCard — assignee', () => {
  it('shows the assignee name when showAssignee is true', () => {
    setSettings({ showAssignee: true })
    render(<FeatureCard feature={makeFeature({ assignee: 'lucio' })} onClick={() => {}} />)
    expect(screen.getByText('lucio')).toBeInTheDocument()
  })

  it('hides the assignee when showAssignee is false', () => {
    setSettings({ showAssignee: false })
    render(<FeatureCard feature={makeFeature({ assignee: 'lucio' })} onClick={() => {}} />)
    expect(screen.queryByText('lucio')).not.toBeInTheDocument()
  })

  it('shows nothing when assignee is null', () => {
    setSettings({ showAssignee: true })
    render(<FeatureCard feature={makeFeature({ assignee: null })} onClick={() => {}} />)
    // card still renders without throwing
    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument()
  })

  it('renders the initials from the assignee name', () => {
    setSettings({ showAssignee: true })
    render(<FeatureCard feature={makeFeature({ assignee: 'John Doe' })} onClick={() => {}} />)
    expect(screen.getByText('JD')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// onClick
// ---------------------------------------------------------------------------

describe('FeatureCard — onClick', () => {
  it('calls the onClick handler when the card is clicked', () => {
    setSettings()
    let clicked = false
    render(<FeatureCard feature={makeFeature()} onClick={() => { clicked = true }} />)
    fireEvent.click(screen.getByRole('heading', { level: 3 }).closest('div')!)
    expect(clicked).toBe(true)
  })
})
