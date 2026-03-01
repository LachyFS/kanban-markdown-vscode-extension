// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuickAddInput } from '../../../src/webview/components/QuickAddInput'
import { useStore } from '../../../src/webview/store'

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

function setup(onAdd = vi.fn()) {
  const user = userEvent.setup({ writeToClipboard: false })
  render(<QuickAddInput status="todo" onAdd={onAdd} />)
  return { user, onAdd }
}

// ---------------------------------------------------------------------------
// Initial state — button
// ---------------------------------------------------------------------------

describe('QuickAddInput — initial state', () => {
  it('renders the "Add feature" button and no input', () => {
    setup()
    expect(screen.getByRole('button', { name: /add feature/i })).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Feature title...')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Opening the input
// ---------------------------------------------------------------------------

describe('QuickAddInput — opening', () => {
  it('shows the text input when the button is clicked', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: /add feature/i }))
    expect(screen.getByPlaceholderText('Feature title...')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add feature/i })).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Submitting via Enter
// ---------------------------------------------------------------------------

describe('QuickAddInput — submit on Enter', () => {
  it('calls onAdd with the title as a # heading when Enter is pressed', async () => {
    const { user, onAdd } = setup()
    await user.click(screen.getByRole('button', { name: /add feature/i }))
    await user.type(screen.getByPlaceholderText('Feature title...'), 'My Feature{Enter}')
    expect(onAdd).toHaveBeenCalledOnce()
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      content: '# My Feature',
      status: 'todo'
    }))
  })

  it('uses the store defaultPriority in the onAdd call', async () => {
    useStore.setState({ cardSettings: { ...initialState.cardSettings, defaultPriority: 'critical' } })
    const { user, onAdd } = setup()
    await user.click(screen.getByRole('button', { name: /add feature/i }))
    await user.type(screen.getByPlaceholderText('Feature title...'), 'Urgent task{Enter}')
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ priority: 'critical' }))
  })

  it('trims whitespace from the title before calling onAdd', async () => {
    const { user, onAdd } = setup()
    await user.click(screen.getByRole('button', { name: /add feature/i }))
    await user.type(screen.getByPlaceholderText('Feature title...'), '  Trimmed  {Enter}')
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ content: '# Trimmed' }))
  })

  it('returns to the button state after successful submit', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: /add feature/i }))
    await user.type(screen.getByPlaceholderText('Feature title...'), 'Done{Enter}')
    expect(screen.getByRole('button', { name: /add feature/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Empty / whitespace input — no submit
// ---------------------------------------------------------------------------

describe('QuickAddInput — empty input guard', () => {
  it('does not call onAdd when Enter is pressed with an empty input', async () => {
    const { user, onAdd } = setup()
    await user.click(screen.getByRole('button', { name: /add feature/i }))
    await user.keyboard('{Enter}')
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('does not call onAdd when input is whitespace only', async () => {
    const { user, onAdd } = setup()
    await user.click(screen.getByRole('button', { name: /add feature/i }))
    await user.type(screen.getByPlaceholderText('Feature title...'), '   {Enter}')
    expect(onAdd).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Escape — dismiss
// ---------------------------------------------------------------------------

describe('QuickAddInput — Escape', () => {
  it('returns to the button state when Escape is pressed', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: /add feature/i }))
    await user.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: /add feature/i })).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Feature title...')).not.toBeInTheDocument()
  })

  it('does not call onAdd when Escape is pressed after typing', async () => {
    const { user, onAdd } = setup()
    await user.click(screen.getByRole('button', { name: /add feature/i }))
    await user.type(screen.getByPlaceholderText('Feature title...'), 'Some text')
    await user.keyboard('{Escape}')
    expect(onAdd).not.toHaveBeenCalled()
  })
})
