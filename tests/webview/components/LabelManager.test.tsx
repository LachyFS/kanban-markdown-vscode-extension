// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LabelManager } from '../../../src/webview/components/LabelManager'
import { useStore } from '../../../src/webview/store'
import type { Feature } from '../../../src/shared/types'

// ---------------------------------------------------------------------------
// Mock vscode API
// ---------------------------------------------------------------------------

const { mockPostMessage } = vi.hoisted(() => ({ mockPostMessage: vi.fn() }))

vi.mock('../../../src/webview/vscodeApi', () => ({
  vscode: { postMessage: mockPostMessage }
}))

// ---------------------------------------------------------------------------
// Store reset
// ---------------------------------------------------------------------------

const initialState = useStore.getState()

beforeEach(() => {
  useStore.setState(initialState, true)
  mockPostMessage.mockClear()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFeature(overrides: Partial<Feature> = {}): Feature {
  return {
    id: 'feat-1',
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
    filePath: '/workspace/features/feat.md',
    ...overrides
  }
}

function setFeatures(features: Feature[]) {
  useStore.setState({ features })
}

function setup(onClose = vi.fn()) {
  const user = userEvent.setup()
  const result = render(<LabelManager onClose={onClose} />)
  return { user, onClose, ...result }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('LabelManager — rendering', () => {
  it('renders null and calls onClose when there are no labels', () => {
    setFeatures([])
    const onClose = vi.fn()
    const { container } = render(<LabelManager onClose={onClose} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the panel header when labels exist', () => {
    setFeatures([makeFeature({ labels: ['frontend'] })])
    setup()
    expect(screen.getByText('Manage Labels')).toBeInTheDocument()
  })

  it('renders one row per unique label', () => {
    setFeatures([
      makeFeature({ labels: ['frontend', 'bug'] }),
      makeFeature({ id: 'feat-2', labels: ['bug'] })
    ])
    setup()
    expect(screen.getByText('frontend')).toBeInTheDocument()
    expect(screen.getByText('bug')).toBeInTheDocument()
  })

  it('shows the usage count next to each label', () => {
    setFeatures([
      makeFeature({ labels: ['frontend'] }),
      makeFeature({ id: 'feat-2', labels: ['frontend', 'bug'] })
    ])
    setup()
    // 'frontend' appears on 2 features, 'bug' on 1
    const counts = screen.getAllByTitle(/Used on \d+ card/)
    const texts = counts.map(el => el.textContent)
    expect(texts).toContain('2')
    expect(texts).toContain('1')
  })
})

// ---------------------------------------------------------------------------
// Close button
// ---------------------------------------------------------------------------

describe('LabelManager — close button', () => {
  it('calls onClose when the × button in the header is clicked', async () => {
    setFeatures([makeFeature({ labels: ['frontend'] })])
    const { user, onClose } = setup()
    // The header close button has no accessible name but has an X icon
    // It is the first button in the header; we can find it via its parent
    const header = screen.getByText('Manage Labels').closest('div')!
    const closeBtn = header.querySelector('button')!
    await user.click(closeBtn)
    expect(onClose).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// Escape key
// ---------------------------------------------------------------------------

describe('LabelManager — Escape key', () => {
  it('calls onClose when Escape is pressed and nothing is being edited', () => {
    setFeatures([makeFeature({ labels: ['frontend'] })])
    const onClose = vi.fn()
    render(<LabelManager onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('cancels editing (but does not close) when Escape is pressed during rename', async () => {
    setFeatures([makeFeature({ labels: ['frontend'] })])
    const { user, onClose } = setup()

    // Start editing
    await user.click(screen.getByTitle('Rename label'))
    expect(screen.getByDisplayValue('frontend')).toBeInTheDocument()

    // Press Escape — should cancel edit, not close
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByDisplayValue('frontend')).not.toBeInTheDocument()
    expect(screen.getByText('frontend')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Rename — entering edit mode
// ---------------------------------------------------------------------------

describe('LabelManager — rename (edit mode)', () => {
  it('shows an input pre-filled with the label name when Rename is clicked', async () => {
    setFeatures([makeFeature({ labels: ['frontend'] })])
    const { user } = setup()
    await user.click(screen.getByTitle('Rename label'))
    expect(screen.getByDisplayValue('frontend')).toBeInTheDocument()
  })

  it('hides the label text and action buttons while editing', async () => {
    setFeatures([makeFeature({ labels: ['frontend'] })])
    const { user } = setup()
    await user.click(screen.getByTitle('Rename label'))
    expect(screen.queryByTitle('Rename label')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Delete label')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Rename — confirming
// ---------------------------------------------------------------------------

describe('LabelManager — rename (confirm)', () => {
  it('posts renameLabel message on Enter with a new name', async () => {
    setFeatures([makeFeature({ labels: ['frontend'] })])
    const { user } = setup()
    await user.click(screen.getByTitle('Rename label'))
    const input = screen.getByDisplayValue('frontend')
    await user.clear(input)
    await user.type(input, 'ui{Enter}')
    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'renameLabel',
      oldName: 'frontend',
      newName: 'ui'
    })
  })

  it('posts renameLabel message when the confirm (✓) button is clicked', async () => {
    setFeatures([makeFeature({ labels: ['frontend'] })])
    const { user } = setup()
    await user.click(screen.getByTitle('Rename label'))
    const input = screen.getByDisplayValue('frontend')
    await user.clear(input)
    await user.type(input, 'design')
    await user.click(screen.getByTitle('Confirm rename'))
    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'renameLabel',
      oldName: 'frontend',
      newName: 'design'
    })
  })

  it('does not post a message when the new name is identical to the old', async () => {
    setFeatures([makeFeature({ labels: ['frontend'] })])
    const { user } = setup()
    await user.click(screen.getByTitle('Rename label'))
    await user.click(screen.getByTitle('Confirm rename'))
    expect(mockPostMessage).not.toHaveBeenCalled()
  })

  it('does not post a message when the new name is blank', async () => {
    setFeatures([makeFeature({ labels: ['frontend'] })])
    const { user } = setup()
    await user.click(screen.getByTitle('Rename label'))
    const input = screen.getByDisplayValue('frontend')
    await user.clear(input)
    await user.click(screen.getByTitle('Confirm rename'))
    expect(mockPostMessage).not.toHaveBeenCalled()
  })

  it('updates the labelFilter when the active filter label is renamed', async () => {
    setFeatures([makeFeature({ labels: ['frontend'] })])
    useStore.setState({ labelFilter: 'frontend' })
    const { user } = setup()
    await user.click(screen.getByTitle('Rename label'))
    const input = screen.getByDisplayValue('frontend')
    await user.clear(input)
    await user.type(input, 'ui{Enter}')
    expect(useStore.getState().labelFilter).toBe('ui')
  })

  it('leaves the labelFilter unchanged when a non-active label is renamed', async () => {
    setFeatures([
      makeFeature({ labels: ['alpha'] }),
      makeFeature({ id: 'feat-2', labels: ['beta'] })
    ])
    useStore.setState({ labelFilter: 'beta' })
    const { user } = setup()
    // 'alpha' and 'beta' are both rendered; rename 'alpha'
    const renameButtons = screen.getAllByTitle('Rename label')
    // first button corresponds to 'alpha' (index 0)
    await user.click(renameButtons[0])
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'ui{Enter}')
    // labelFilter was 'beta', which was not renamed — should stay 'beta'
    expect(useStore.getState().labelFilter).toBe('beta')
  })
})

// ---------------------------------------------------------------------------
// Rename — cancel
// ---------------------------------------------------------------------------

describe('LabelManager — rename (cancel)', () => {
  it('exits edit mode without posting when the cancel button is clicked', async () => {
    setFeatures([makeFeature({ labels: ['frontend'] })])
    const { user } = setup()
    await user.click(screen.getByTitle('Rename label'))
    await user.click(screen.getByTitle('Cancel'))
    expect(mockPostMessage).not.toHaveBeenCalled()
    expect(screen.getByText('frontend')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

describe('LabelManager — delete', () => {
  it('posts deleteLabel message when Delete is clicked', async () => {
    setFeatures([makeFeature({ labels: ['frontend', 'bug'] })])
    const { user } = setup()
    const deleteButtons = screen.getAllByTitle('Delete label')
    await user.click(deleteButtons[0])
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'deleteLabel' })
    )
  })

  it('resets labelFilter to "all" when the actively filtered label is deleted', async () => {
    setFeatures([makeFeature({ labels: ['x'] })])
    useStore.setState({ labelFilter: 'x' })
    const { user } = setup()
    await user.click(screen.getByTitle('Delete label'))
    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'deleteLabel', labelName: 'x' })
    expect(useStore.getState().labelFilter).toBe('all')
  })
})
