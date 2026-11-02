import * as path from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveMarkdownLink } from '../../src/extension/markdownLinks'

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: () => ({ get: (_key: string, fallback: unknown) => fallback }),
    fs: { stat: vi.fn(async () => ({})) },
    openTextDocument: vi.fn(async uri => uri)
  },
  Uri: { file: (fsPath: string) => ({ fsPath }), parse: (value: string) => ({ value }) },
  env: { openExternal: vi.fn() },
  window: { showTextDocument: vi.fn() },
  ViewColumn: { Beside: -2 }
}))
import * as vscode from 'vscode'
import { KanbanPanel } from '../../src/extension/KanbanPanel'

const root = path.resolve('workspace')
const source = path.join(root, '.devtool/features/done/source.md')

describe('relative Markdown links', () => {
  it('resolves relative to the source file, decodes spaces and ignores a heading fragment', () => {
    expect(resolveMarkdownLink('../other%20card.md#details', source, [root]))
      .toBe(path.join(root, '.devtool/features/other card.md'))
    expect(resolveMarkdownLink('../../../README.md', source, [root])).toBe(path.join(root, 'README.md'))
  })

  it.each([
    '../../../../private.md', '/etc/private.md', '%2Fetc%2Fprivate.md',
    'command:workbench.action.terminal.new', 'javascript:alert(1)', 'file:///etc/private.md',
    'https://example.com/file.md', '//server/share/file.md', '\\\\server\\share\\file.md',
    'C:\\private.md', 'other.txt', 'other%00.md', 'bad%path.md', '#section'
  ])('rejects paths or schemes outside the Markdown navigation scope: %s', href => {
    expect(resolveMarkdownLink(href, source, [root])).toBeUndefined()
  })
})

describe('webview link requests', () => {
  beforeEach(() => vi.clearAllMocks())

  function panel() {
    const instance = Object.create(KanbanPanel.prototype)
    instance._features = [
      { id: 'source', filePath: source },
      { id: 'other', filePath: path.join(root, '.devtool/features/other.md') }
    ]
    instance._getMarkdownResourceRoots = () => [{ fsPath: root }]
    instance._sendFeatureContent = vi.fn()
    return instance
  }

  it('opens known cards in the board and other workspace Markdown in the native editor', async () => {
    const instance = panel()
    await instance._openMarkdownLink('source', '../other.md')
    expect(instance._sendFeatureContent).toHaveBeenCalledWith('other')
    expect(vscode.workspace.openTextDocument).not.toHaveBeenCalled()
    await instance._openMarkdownLink('source', '../../../README.md')
    expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith({ fsPath: path.join(root, 'README.md') })
    expect(vscode.window.showTextDocument).toHaveBeenCalledOnce()
  })

  it('opens external HTTPS links only for an existing source card', async () => {
    const instance = panel()
    await instance._openMarkdownLink('unknown', 'https://example.com/')
    expect(vscode.env.openExternal).not.toHaveBeenCalled()
    await instance._openMarkdownLink('source', 'https://example.com/')
    expect(vscode.env.openExternal).toHaveBeenCalledWith({ value: 'https://example.com/' })
  })

  it('ignores malformed, command, file and out-of-workspace requests', async () => {
    const instance = panel()
    for (const href of [null, {}, 'command:workbench.action.terminal.new', 'file:///private.md', '../../../../private.md']) {
      await instance._openMarkdownLink('source', href)
    }
    expect(vscode.env.openExternal).not.toHaveBeenCalled()
    expect(vscode.workspace.openTextDocument).not.toHaveBeenCalled()
    expect(vscode.workspace.fs.stat).not.toHaveBeenCalled()
    expect(instance._sendFeatureContent).not.toHaveBeenCalled()
  })
})
