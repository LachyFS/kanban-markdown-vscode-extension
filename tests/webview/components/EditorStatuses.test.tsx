// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { FeatureEditor } from '../../../src/webview/components/FeatureEditor'
import { CreateFeatureDialog } from '../../../src/webview/components/CreateFeatureDialog'
import { useStore } from '../../../src/webview/store'
import type { FeatureFrontmatter } from '../../../src/shared/types'

const initialState = useStore.getState()
const frontmatter: FeatureFrontmatter = {
  id: 'custom', status: 'blocked', priority: 'medium', assignee: null, epic: null,
  dueDate: null, created: '', modified: '', completedAt: null, labels: [], order: 'a0'
}

beforeEach(() => {
  useStore.setState({ ...initialState, columns: [
    { id: 'blocked', name: 'Blocked custom', color: '#ff0000' },
    { id: 'testing', name: 'Testing custom', color: '#00ff00' }
  ] }, true)
})

describe('configured editor statuses', () => {
  it('resolves image paths against the newly opened card directory', () => {
    const props = {
      featureId: 'first', content: '# First\n\n![Image](image.png)', frontmatter,
      resourceBaseUri: 'https://file.vscode-resource.vscode-cdn.net/first/',
      onSave: vi.fn(), onClose: vi.fn(), onDelete: vi.fn(), onOpenFile: vi.fn(),
      onOpenLink: vi.fn(), onStartWithAI: vi.fn()
    }
    const { rerender } = render(<FeatureEditor {...props} />)
    expect(screen.getByAltText('Image')).toHaveAttribute('src', `${props.resourceBaseUri}image.png`)
    rerender(<FeatureEditor {...props} featureId="second" content={'# Second\n\n![Image](image.png)'}
      resourceBaseUri="https://file.vscode-resource.vscode-cdn.net/second/" />)
    expect(screen.getByAltText('Image')).toHaveAttribute('src', 'https://file.vscode-resource.vscode-cdn.net/second/image.png')
  })

  it('displays, selects and saves configured statuses on an existing card', () => {
    const onSave = vi.fn()
    render(<FeatureEditor featureId="custom" content="# Custom card" frontmatter={frontmatter}
      onSave={onSave} onClose={vi.fn()} onDelete={vi.fn()} onOpenFile={vi.fn()}
      onOpenLink={vi.fn()} onStartWithAI={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Blocked custom' }))
    fireEvent.click(screen.getByRole('button', { name: 'Testing custom' }))
    fireEvent.keyDown(window, { key: 's', ctrlKey: true })
    expect(onSave).toHaveBeenLastCalledWith('# Custom card', expect.objectContaining({ status: 'testing' }))
  })

  it('creates a card using a configured status when default backlog is absent', () => {
    const onCreate = vi.fn()
    render(<CreateFeatureDialog isOpen onClose={vi.fn()} onCreate={onCreate} />)
    fireEvent.change(screen.getByPlaceholderText('Feature title...'), { target: { value: 'Custom creation' } })
    fireEvent.click(screen.getByRole('button', { name: 'Blocked custom' }))
    fireEvent.click(screen.getByRole('button', { name: 'Testing custom' }))
    fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true })
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ status: 'testing', content: '# Custom creation' }))
  })
})
