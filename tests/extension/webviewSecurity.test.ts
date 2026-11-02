import { describe, expect, it, vi } from 'vitest'

const settings = vi.hoisted(() => ({ zoom: undefined as unknown }))
vi.mock('vscode', () => ({
  workspace: { getConfiguration: () => ({ get: () => settings.zoom }) },
  Uri: { joinPath: (_uri: unknown, ...parts: string[]) => parts.join('/') }
}))

import { KanbanPanel } from '../../src/extension/KanbanPanel'

describe('board webview security', () => {
  it('cannot inject HTML through a malformed workspace zoom setting', () => {
    settings.zoom = '</style><script src="https://attacker.invalid/evil.js"></script>'
    const panel = Object.create(KanbanPanel.prototype)
    const html: string = panel._getHtmlForWebview({
      cspSource: 'vscode-webview://test',
      asWebviewUri: (uri: string) => uri
    })
    expect(html).not.toContain('attacker.invalid')
    expect(html).not.toContain('unsafe-inline')
    expect(html).toContain('--kanban-zoom: 1;')
    const nonce = html.match(/<style nonce="([^"]+)"/)?.[1]
    expect(nonce).toMatch(/^[A-Za-z0-9_-]{32}$/)
    expect(html).toContain(`style-src vscode-webview://test 'nonce-${nonce}'`)
  })
})
