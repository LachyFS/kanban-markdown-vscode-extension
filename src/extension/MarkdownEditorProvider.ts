import * as vscode from 'vscode'
import type { FeatureFrontmatter, EditorExtensionMessage, EditorWebviewMessage } from '../shared/editorTypes'
import type { FeatureStatus, Priority } from '../shared/types'

export class MarkdownEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'kanban-markdown.featureEditor'

  private readonly _extensionUri: vscode.Uri

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new MarkdownEditorProvider(context.extensionUri)
    const registration = vscode.window.registerCustomEditorProvider(
      MarkdownEditorProvider.viewType,
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true
        },
        supportsMultipleEditorsPerDocument: false
      }
    )
    return registration
  }

  constructor(extensionUri: vscode.Uri) {
    this._extensionUri = extensionUri
  }

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'dist'),
        vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview')
      ]
    }

    webviewPanel.webview.html = this._getHtmlForWebview(webviewPanel.webview)

    // Track if we're currently updating from the webview to avoid loops
    let isUpdatingFromWebview = false

    // Send initial content when webview is ready
    const sendDocumentToWebview = () => {
      const { frontmatter, content } = this._parseDocument(document.getText())
      const fileName = document.uri.path.split('/').pop()?.replace(/\.md$/, '') || 'Untitled'
      const message: EditorExtensionMessage = {
        type: 'init',
        content,
        frontmatter,
        fileName
      }
      webviewPanel.webview.postMessage(message)
    }

    // Handle messages from the webview
    webviewPanel.webview.onDidReceiveMessage(async (message: EditorWebviewMessage) => {
      switch (message.type) {
        case 'ready':
          sendDocumentToWebview()
          break

        case 'contentUpdate': {
          isUpdatingFromWebview = true
          const { frontmatter } = this._parseDocument(document.getText())
          const newText = this._serializeDocument(frontmatter, message.content)

          const edit = new vscode.WorkspaceEdit()
          edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            newText
          )
          await vscode.workspace.applyEdit(edit)
          isUpdatingFromWebview = false
          break
        }

        case 'frontmatterUpdate': {
          isUpdatingFromWebview = true
          const { content } = this._parseDocument(document.getText())
          const newText = this._serializeDocument(message.frontmatter, content)

          const edit = new vscode.WorkspaceEdit()
          edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            newText
          )
          await vscode.workspace.applyEdit(edit)
          isUpdatingFromWebview = false
          break
        }

        case 'requestSave':
          await document.save()
          break

        case 'startWithAI': {
          // Save the document first to ensure AI sees latest changes
          await document.save()

          // Build the prompt from the document content
          const fullText = document.getText()
          const { frontmatter: fm, content: docContent } = this._parseDocument(fullText)

          // Build a concise single-line prompt that references the file
          const labels = fm.labels.length > 0 ? ` [${fm.labels.join(', ')}]` : ''
          const description = docContent.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
          const shortDesc = description.length > 200 ? description.substring(0, 200) + '...' : description

          const prompt = `Implement this feature: "${fm.title}" (${fm.priority} priority)${labels}. ${shortDesc} See full details in: ${document.uri.fsPath}`

          // Get agent and permission mode
          const agent = message.agent || 'claude'
          const permissionMode = message.permissionMode || 'default'

          // Build the command based on selected agent
          let command: string
          const escapedPrompt = prompt.replace(/"/g, '\\"')

          switch (agent) {
            case 'claude': {
              const permissionFlag = permissionMode !== 'default' ? ` --permission-mode ${permissionMode}` : ''
              command = `claude${permissionFlag} "${escapedPrompt}"`
              break
            }
            case 'codex': {
              // Codex CLI flags: --approval-mode (suggest, auto-edit, full-auto)
              const approvalMap: Record<string, string> = {
                'default': 'suggest',
                'plan': 'suggest',
                'acceptEdits': 'auto-edit',
                'bypassPermissions': 'full-auto'
              }
              const approvalMode = approvalMap[permissionMode] || 'suggest'
              command = `codex --approval-mode ${approvalMode} "${escapedPrompt}"`
              break
            }
            case 'opencode': {
              // OpenCode doesn't have permission flags, just run with prompt
              command = `opencode "${escapedPrompt}"`
              break
            }
            default:
              command = `claude "${escapedPrompt}"`
          }

          // Create or show terminal and run command
          const agentNames: Record<string, string> = {
            'claude': 'Claude Code',
            'codex': 'Codex',
            'opencode': 'OpenCode'
          }
          const terminal = vscode.window.createTerminal({
            name: agentNames[agent] || 'AI Agent',
            cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
          })
          terminal.show()
          terminal.sendText(command)
          break
        }
      }
    })

    // Listen for document changes (from external edits or undo/redo)
    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.uri.toString() === document.uri.toString() && !isUpdatingFromWebview) {
        const { content } = this._parseDocument(document.getText())
        const message: EditorExtensionMessage = {
          type: 'contentChanged',
          content
        }
        webviewPanel.webview.postMessage(message)
      }
    })

    // Clean up when panel is closed
    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose()
    })
  }

  private _parseDocument(text: string): { frontmatter: FeatureFrontmatter; content: string } {
    const frontmatterMatch = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)

    if (!frontmatterMatch) {
      // No frontmatter, return defaults
      return {
        frontmatter: this._getDefaultFrontmatter(),
        content: text
      }
    }

    const frontmatterText = frontmatterMatch[1]
    const content = frontmatterMatch[2] || ''

    const getValue = (key: string): string => {
      const match = frontmatterText.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'))
      if (!match) return ''
      const value = match[1].trim().replace(/^["']|["']$/g, '')
      return value === 'null' ? '' : value
    }

    const getArrayValue = (key: string): string[] => {
      const match = frontmatterText.match(new RegExp(`^${key}:\\s*\\[([^\\]]*)\\]`, 'm'))
      if (!match) return []
      return match[1].split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
    }

    const frontmatter: FeatureFrontmatter = {
      id: getValue('id') || 'unknown',
      title: getValue('title') || 'Untitled',
      status: (getValue('status') as FeatureStatus) || 'backlog',
      priority: (getValue('priority') as Priority) || 'medium',
      assignee: getValue('assignee') || null,
      dueDate: getValue('dueDate') || null,
      created: getValue('created') || new Date().toISOString(),
      modified: getValue('modified') || new Date().toISOString(),
      labels: getArrayValue('labels'),
      order: parseInt(getValue('order')) || 0
    }

    return { frontmatter, content: content.trim() }
  }

  private _getDefaultFrontmatter(): FeatureFrontmatter {
    const now = new Date().toISOString()
    return {
      id: 'unknown',
      title: 'Untitled',
      status: 'backlog',
      priority: 'medium',
      assignee: null,
      dueDate: null,
      created: now,
      modified: now,
      labels: [],
      order: 0
    }
  }

  private _serializeDocument(frontmatter: FeatureFrontmatter, content: string): string {
    // Update modified timestamp
    const updatedFrontmatter = {
      ...frontmatter,
      modified: new Date().toISOString()
    }

    const frontmatterLines = [
      '---',
      `id: "${updatedFrontmatter.id}"`,
      `title: "${updatedFrontmatter.title}"`,
      `status: "${updatedFrontmatter.status}"`,
      `priority: "${updatedFrontmatter.priority}"`,
      `assignee: ${updatedFrontmatter.assignee ? `"${updatedFrontmatter.assignee}"` : 'null'}`,
      `dueDate: ${updatedFrontmatter.dueDate ? `"${updatedFrontmatter.dueDate}"` : 'null'}`,
      `created: "${updatedFrontmatter.created}"`,
      `modified: "${updatedFrontmatter.modified}"`,
      `labels: [${updatedFrontmatter.labels.map(l => `"${l}"`).join(', ')}]`,
      `order: ${updatedFrontmatter.order}`,
      '---',
      ''
    ].join('\n')

    return frontmatterLines + content
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'editor.js')
    )
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'style.css')
    )

    const nonce = this._getNonce()

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <link href="${styleUri}" rel="stylesheet">
  <title>Feature Editor</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`
  }

  private _getNonce(): string {
    let text = ''
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length))
    }
    return text
  }
}
