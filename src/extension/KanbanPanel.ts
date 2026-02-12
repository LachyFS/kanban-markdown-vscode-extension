import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import { getTitleFromContent, generateFeatureFilename } from '../shared/types'
import type { Feature, FeatureStatus, Priority, KanbanColumn, FeatureFrontmatter, CardDisplaySettings } from '../shared/types'
import { ensureStatusSubfolders, moveFeatureFile, getFeatureFilePath, getStatusFromPath, getStatusFolders } from './featureFileUtils'

interface CreateFeatureData {
  status: FeatureStatus
  priority: Priority
  content: string
  assignee: string | null
  dueDate: string | null
  labels: string[]
}

export class KanbanPanel {
  public static readonly viewType = 'kanban-markdown.panel'
  public static currentPanel: KanbanPanel | undefined

  private readonly _panel: vscode.WebviewPanel
  private readonly _extensionUri: vscode.Uri
  private readonly _context: vscode.ExtensionContext
  private _features: Feature[] = []
  private _disposables: vscode.Disposable[] = []
  private _fileWatcher: vscode.FileSystemWatcher | undefined
  private _currentEditingFeatureId: string | null = null
  private _migrating = false
  private _onDisposeCallbacks: (() => void)[] = []

  public static createOrShow(extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined

    // If we already have a panel, show it
    if (KanbanPanel.currentPanel) {
      KanbanPanel.currentPanel._panel.reveal(column)
      return
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      KanbanPanel.viewType,
      'Kanban Board',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'dist'),
          vscode.Uri.joinPath(extensionUri, 'dist', 'webview')
        ]
      }
    )

    // Set the tab icon
    panel.iconPath = {
      light: vscode.Uri.joinPath(extensionUri, 'resources', 'kanban-light.svg'),
      dark: vscode.Uri.joinPath(extensionUri, 'resources', 'kanban-dark.svg')
    }

    KanbanPanel.currentPanel = new KanbanPanel(panel, extensionUri, context)
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
    KanbanPanel.currentPanel = new KanbanPanel(panel, extensionUri, context)
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
    this._panel = panel
    this._extensionUri = extensionUri
    this._context = context

    // Ensure webview options are set (critical for deserialization after reload)
    this._panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(extensionUri, 'dist'),
        vscode.Uri.joinPath(extensionUri, 'dist', 'webview')
      ]
    }

    // Set the webview's initial html content
    this._update()

    // Listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables)

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case 'ready':
            await this._loadFeatures()
            this._sendFeaturesToWebview()
            break
          case 'createFeature':
            await this._createFeature(message.data)
            break
          case 'moveFeature':
            await this._moveFeature(message.featureId, message.newStatus, message.newOrder)
            break
          case 'deleteFeature':
            await this._deleteFeature(message.featureId)
            break
          case 'updateFeature':
            await this._updateFeature(message.featureId, message.updates)
            break
          case 'openFeature':
            await this._sendFeatureContent(message.featureId)
            break
          case 'saveFeatureContent':
            await this._saveFeatureContent(message.featureId, message.content, message.frontmatter)
            break
          case 'closeFeature':
            // Nothing to do on extension side
            break
          case 'focusMenuBar':
            vscode.commands.executeCommand('workbench.action.focusMenuBar')
            break
          case 'startWithAI':
            await this._startWithAI(message.agent, message.permissionMode)
            break
        }
      },
      null,
      this._disposables
    )

    // Set up file watcher for feature files
    this._setupFileWatcher()

    // Listen for settings changes and push updates to webview
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('kanban-markdown')) {
        if (e.affectsConfiguration('kanban-markdown.featuresDirectory')) {
          // Features directory changed - need to reload everything
          this._setupFileWatcher()
          this._loadFeatures().then(() => this._sendFeaturesToWebview())
        } else {
          this._sendFeaturesToWebview()
        }
      } else if (e.affectsConfiguration('chat.disableAIFeatures')) {
        this._sendFeaturesToWebview()
      }
    }, null, this._disposables)
  }

  private _setupFileWatcher(): void {
    // Dispose old watcher if re-setting up (e.g. featuresDirectory changed)
    if (this._fileWatcher) {
      this._fileWatcher.dispose()
    }

    const featuresDir = this._getWorkspaceFeaturesDir()
    if (!featuresDir) return

    // Watch for changes in the features directory (recursive for status subfolders)
    const pattern = new vscode.RelativePattern(featuresDir, '**/*.md')
    this._fileWatcher = vscode.workspace.createFileSystemWatcher(pattern)

    // Debounce to avoid multiple rapid updates
    let debounceTimer: NodeJS.Timeout | undefined

    const handleFileChange = () => {
      if (this._migrating) return
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(async () => {
        await this._loadFeatures()
        this._sendFeaturesToWebview()
      }, 100)
    }

    this._fileWatcher.onDidChange(handleFileChange, null, this._disposables)
    this._fileWatcher.onDidCreate(handleFileChange, null, this._disposables)
    this._fileWatcher.onDidDelete(handleFileChange, null, this._disposables)

    this._disposables.push(this._fileWatcher)
  }

  public onDispose(callback: () => void): void {
    this._onDisposeCallbacks.push(callback)
  }

  public dispose() {
    KanbanPanel.currentPanel = undefined

    for (const cb of this._onDisposeCallbacks) {
      cb()
    }
    this._onDisposeCallbacks = []

    this._panel.dispose()

    while (this._disposables.length) {
      const x = this._disposables.pop()
      if (x) {
        x.dispose()
      }
    }
  }

  private _update() {
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview)
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'index.js')
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
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${nonce}';">
  <link href="${styleUri}" rel="stylesheet">
  <title>Kanban Board</title>
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

  private _getWorkspaceFeaturesDir(): string | null {
    const workspaceFolders = vscode.workspace.workspaceFolders
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return null
    }
    const config = vscode.workspace.getConfiguration('kanban-markdown')
    const featuresDirectory = config.get<string>('featuresDirectory') || '.devtool/features'
    return path.join(workspaceFolders[0].uri.fsPath, featuresDirectory)
  }

  private async _ensureFeaturesDir(): Promise<string | null> {
    const featuresDir = this._getWorkspaceFeaturesDir()
    if (!featuresDir) return null

    try {
      await fs.promises.mkdir(featuresDir, { recursive: true })
      await ensureStatusSubfolders(featuresDir)
      return featuresDir
    } catch {
      return null
    }
  }

  private async _loadFeatures(): Promise<void> {
    const featuresDir = this._getWorkspaceFeaturesDir()
    if (!featuresDir) {
      this._features = []
      return
    }

    try {
      await fs.promises.mkdir(featuresDir, { recursive: true })
      await ensureStatusSubfolders(featuresDir)

      // Phase 1: Migrate root-level .md files into status subfolders
      this._migrating = true
      try {
        const rootEntries = await fs.promises.readdir(featuresDir, { withFileTypes: true })
        for (const entry of rootEntries) {
          if (!entry.isFile() || !entry.name.endsWith('.md')) continue
          const filePath = path.join(featuresDir, entry.name)
          try {
            const content = await fs.promises.readFile(filePath, 'utf-8')
            const feature = this._parseFeatureFile(content, filePath)
            const status = feature?.status || 'backlog'
            await moveFeatureFile(filePath, featuresDir, status)
          } catch {
            // Skip files that fail to migrate (e.g. already moved)
          }
        }
      } finally {
        this._migrating = false
      }

      // Phase 2: Load from all status subdirectories
      const features: Feature[] = []
      const statusFolders = getStatusFolders()

      for (const status of statusFolders) {
        const subdir = path.join(featuresDir, status)
        try {
          const files = await fs.promises.readdir(subdir)
          for (const file of files) {
            if (!file.endsWith('.md')) continue
            const filePath = path.join(subdir, file)
            const content = await fs.promises.readFile(filePath, 'utf-8')
            const feature = this._parseFeatureFile(content, filePath)
            if (feature) features.push(feature)
          }
        } catch {
          // Subdirectory may not exist yet; skip
        }
      }

      // Phase 3: Reconcile mismatches (frontmatter status != subfolder)
      this._migrating = true
      try {
        for (const feature of features) {
          const currentSubfolder = getStatusFromPath(feature.filePath, featuresDir)
          if (currentSubfolder && currentSubfolder !== feature.status) {
            try {
              const newPath = await moveFeatureFile(feature.filePath, featuresDir, feature.status)
              feature.filePath = newPath
            } catch {
              // Skip files that fail to move (will retry on next load)
            }
          }
        }
      } finally {
        this._migrating = false
      }

      this._features = features.sort((a, b) => a.order - b.order)
    } catch {
      this._features = []
    }
  }

  private _parseFeatureFile(content: string, filePath: string): Feature | null {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
    if (!frontmatterMatch) return null

    const frontmatter = frontmatterMatch[1]
    const body = frontmatterMatch[2] || ''

    const getValue = (key: string): string => {
      const match = frontmatter.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'))
      if (!match) return ''
      const value = match[1].trim().replace(/^["']|["']$/g, '')
      return value === 'null' ? '' : value
    }

    const getArrayValue = (key: string): string[] => {
      const match = frontmatter.match(new RegExp(`^${key}:\\s*\\[([^\\]]*)\\]`, 'm'))
      if (!match) return []
      return match[1].split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
    }

    return {
      id: getValue('id') || path.basename(filePath, '.md'),
      status: (getValue('status') as FeatureStatus) || 'backlog',
      priority: (getValue('priority') as Priority) || 'medium',
      assignee: getValue('assignee') || null,
      dueDate: getValue('dueDate') || null,
      created: getValue('created') || new Date().toISOString(),
      modified: getValue('modified') || new Date().toISOString(),
      labels: getArrayValue('labels'),
      order: parseInt(getValue('order')) || 0,
      content: body.trim(),
      filePath
    }
  }

  private _serializeFeature(feature: Feature): string {
    const frontmatter = [
      '---',
      `id: "${feature.id}"`,
      `status: "${feature.status}"`,
      `priority: "${feature.priority}"`,
      `assignee: ${feature.assignee ? `"${feature.assignee}"` : 'null'}`,
      `dueDate: ${feature.dueDate ? `"${feature.dueDate}"` : 'null'}`,
      `created: "${feature.created}"`,
      `modified: "${feature.modified}"`,
      `labels: [${feature.labels.map(l => `"${l}"`).join(', ')}]`,
      `order: ${feature.order}`,
      '---',
      ''
    ].join('\n')

    return frontmatter + feature.content
  }

  public triggerCreateDialog(): void {
    this._panel.webview.postMessage({ type: 'triggerCreateDialog' })
  }

  public openFeature(featureId: string): void {
    this._sendFeatureContent(featureId)
  }

  private async _createFeature(data: CreateFeatureData): Promise<void> {
    const featuresDir = await this._ensureFeaturesDir()
    if (!featuresDir) {
      vscode.window.showErrorMessage('No workspace folder open')
      return
    }

    const title = getTitleFromContent(data.content)
    const filename = generateFeatureFilename(title)
    const now = new Date().toISOString()
    const featuresInStatus = this._features.filter(f => f.status === data.status)

    const feature: Feature = {
      id: filename,
      status: data.status,
      priority: data.priority,
      assignee: data.assignee,
      dueDate: data.dueDate,
      created: now,
      modified: now,
      labels: data.labels,
      order: featuresInStatus.length,
      content: data.content,
      filePath: getFeatureFilePath(featuresDir, data.status, filename)
    }

    await fs.promises.mkdir(path.dirname(feature.filePath), { recursive: true })
    const content = this._serializeFeature(feature)
    await fs.promises.writeFile(feature.filePath, content, 'utf-8')

    this._features.push(feature)
    this._sendFeaturesToWebview()
  }

  private async _moveFeature(featureId: string, newStatus: string, newOrder: number): Promise<void> {
    const feature = this._features.find(f => f.id === featureId)
    if (!feature) return

    const featuresDir = this._getWorkspaceFeaturesDir()
    if (!featuresDir) return

    const oldStatus = feature.status
    const statusChanged = oldStatus !== newStatus

    // Remove feature from old column ordering
    const oldColumnFeatures = this._features
      .filter(f => f.status === oldStatus && f.id !== featureId)
      .sort((a, b) => a.order - b.order)

    // Update feature status
    feature.status = newStatus as FeatureStatus
    feature.modified = new Date().toISOString()

    // Get features in the target column (excluding the moved feature)
    const targetColumnFeatures = statusChanged
      ? this._features.filter(f => f.status === newStatus).sort((a, b) => a.order - b.order)
      : oldColumnFeatures

    // Insert at the target position
    const clampedOrder = Math.max(0, Math.min(newOrder, targetColumnFeatures.length))
    targetColumnFeatures.splice(clampedOrder, 0, feature)

    // Reindex target column
    const filesToWrite: Feature[] = []
    for (let i = 0; i < targetColumnFeatures.length; i++) {
      if (targetColumnFeatures[i].order !== i) {
        targetColumnFeatures[i].order = i
        filesToWrite.push(targetColumnFeatures[i])
      }
    }

    // Reindex old column if status changed
    if (statusChanged) {
      for (let i = 0; i < oldColumnFeatures.length; i++) {
        if (oldColumnFeatures[i].order !== i) {
          oldColumnFeatures[i].order = i
          filesToWrite.push(oldColumnFeatures[i])
        }
      }
    }

    // Ensure the moved feature is always persisted
    if (!filesToWrite.includes(feature)) {
      filesToWrite.push(feature)
    }

    // Write all modified features to disk
    for (const f of filesToWrite) {
      const content = this._serializeFeature(f)
      await fs.promises.writeFile(f.filePath, content, 'utf-8')
    }

    // Move file to new subfolder if status changed
    if (statusChanged) {
      this._migrating = true
      try {
        const newPath = await moveFeatureFile(feature.filePath, featuresDir, newStatus)
        feature.filePath = newPath
      } catch {
        // Move failed; file stays in old folder, will reconcile on next load
      } finally {
        this._migrating = false
      }
    }

    this._sendFeaturesToWebview()
  }

  private async _deleteFeature(featureId: string): Promise<void> {
    const feature = this._features.find(f => f.id === featureId)
    if (!feature) return

    try {
      await fs.promises.unlink(feature.filePath)
      this._features = this._features.filter(f => f.id !== featureId)
      this._sendFeaturesToWebview()
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to delete feature: ${err}`)
    }
  }

  private async _updateFeature(featureId: string, updates: Partial<Feature>): Promise<void> {
    const feature = this._features.find(f => f.id === featureId)
    if (!feature) return

    const featuresDir = this._getWorkspaceFeaturesDir()
    if (!featuresDir) return

    const oldStatus = feature.status

    // Merge updates
    Object.assign(feature, updates)
    feature.modified = new Date().toISOString()

    // Persist to file
    const content = this._serializeFeature(feature)
    await fs.promises.writeFile(feature.filePath, content, 'utf-8')

    if (oldStatus !== feature.status) {
      this._migrating = true
      try {
        const newPath = await moveFeatureFile(feature.filePath, featuresDir, feature.status)
        feature.filePath = newPath
      } catch {
        // Move failed; file stays in old folder, will reconcile on next load
      } finally {
        this._migrating = false
      }
    }

    this._sendFeaturesToWebview()
  }

  private async _sendFeatureContent(featureId: string): Promise<void> {
    const feature = this._features.find(f => f.id === featureId)
    if (!feature) return

    this._currentEditingFeatureId = featureId

    const frontmatter: FeatureFrontmatter = {
      id: feature.id,
      status: feature.status,
      priority: feature.priority,
      assignee: feature.assignee,
      dueDate: feature.dueDate,
      created: feature.created,
      modified: feature.modified,
      labels: feature.labels,
      order: feature.order
    }

    this._panel.webview.postMessage({
      type: 'featureContent',
      featureId: feature.id,
      content: feature.content,
      frontmatter
    })
  }

  private async _saveFeatureContent(
    featureId: string,
    content: string,
    frontmatter: FeatureFrontmatter
  ): Promise<void> {
    const feature = this._features.find(f => f.id === featureId)
    if (!feature) return

    const featuresDir = this._getWorkspaceFeaturesDir()
    if (!featuresDir) return

    const oldStatus = feature.status

    // Update feature in memory
    feature.content = content
    feature.status = frontmatter.status
    feature.priority = frontmatter.priority
    feature.assignee = frontmatter.assignee
    feature.dueDate = frontmatter.dueDate
    feature.labels = frontmatter.labels
    feature.modified = new Date().toISOString()

    // Save to file
    const fileContent = this._serializeFeature(feature)
    await fs.promises.writeFile(feature.filePath, fileContent, 'utf-8')

    if (oldStatus !== feature.status) {
      this._migrating = true
      try {
        const newPath = await moveFeatureFile(feature.filePath, featuresDir, feature.status)
        feature.filePath = newPath
      } catch {
        // Move failed; file stays in old folder, will reconcile on next load
      } finally {
        this._migrating = false
      }
    }

    // Update all features in webview
    this._sendFeaturesToWebview()
  }

  private async _startWithAI(
    agent?: 'claude' | 'codex' | 'opencode',
    permissionMode?: 'default' | 'plan' | 'acceptEdits' | 'bypassPermissions'
  ): Promise<void> {
    // Find the currently editing feature
    const feature = this._features.find(f => f.id === this._currentEditingFeatureId)
    if (!feature) {
      vscode.window.showErrorMessage('No feature selected')
      return
    }

    // Parse title from the first # heading in content
    const titleMatch = feature.content.match(/^#\s+(.+)$/m)
    const title = titleMatch ? titleMatch[1].trim() : getTitleFromContent(feature.content)

    const labels = feature.labels.length > 0 ? ` [${feature.labels.join(', ')}]` : ''
    const description = feature.content.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
    const shortDesc = description.length > 200 ? description.substring(0, 200) + '...' : description

    const prompt = `Implement this feature: "${title}" (${feature.priority} priority)${labels}. ${shortDesc} See full details in: ${feature.filePath}`

    // Use provided agent or fall back to config
    const config = vscode.workspace.getConfiguration('kanban-markdown')
    const selectedAgent = agent || config.get<string>('aiAgent') || 'claude'
    const selectedPermissionMode = permissionMode || 'default'

    let command: string
    const escapedPrompt = prompt.replace(/"/g, '\\"')

    switch (selectedAgent) {
      case 'claude': {
        const permissionFlag = selectedPermissionMode !== 'default' ? ` --permission-mode ${selectedPermissionMode}` : ''
        command = `claude${permissionFlag} "${escapedPrompt}"`
        break
      }
      case 'codex': {
        const approvalMap: Record<string, string> = {
          'default': 'suggest',
          'plan': 'suggest',
          'acceptEdits': 'auto-edit',
          'bypassPermissions': 'full-auto'
        }
        const approvalMode = approvalMap[selectedPermissionMode] || 'suggest'
        command = `codex --approval-mode ${approvalMode} "${escapedPrompt}"`
        break
      }
      case 'opencode': {
        command = `opencode "${escapedPrompt}"`
        break
      }
      default:
        command = `claude "${escapedPrompt}"`
    }

    const agentNames: Record<string, string> = {
      'claude': 'Claude Code',
      'codex': 'Codex',
      'opencode': 'OpenCode'
    }
    const terminal = vscode.window.createTerminal({
      name: agentNames[selectedAgent] || 'AI Agent',
      cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    })
    terminal.show()
    terminal.sendText(command)
  }

  private _sendFeaturesToWebview(): void {
    const config = vscode.workspace.getConfiguration('kanban-markdown')

    const defaultColumns: KanbanColumn[] = [
      { id: 'backlog', name: 'Backlog', color: '#6b7280' },
      { id: 'todo', name: 'To Do', color: '#3b82f6' },
      { id: 'in-progress', name: 'In Progress', color: '#f59e0b' },
      { id: 'review', name: 'Review', color: '#8b5cf6' },
      { id: 'done', name: 'Done', color: '#22c55e' }
    ]
    const columns = config.get<KanbanColumn[]>('columns', defaultColumns)
    const settings: CardDisplaySettings = {
      showPriorityBadges: config.get<boolean>('showPriorityBadges', true),
      showAssignee: config.get<boolean>('showAssignee', true),
      showDueDate: config.get<boolean>('showDueDate', true),
      showBuildWithAI: config.get<boolean>('showBuildWithAI', true) && !vscode.workspace.getConfiguration('chat').get<boolean>('disableAIFeatures', false),
      compactMode: config.get<boolean>('compactMode', false),
      defaultPriority: config.get<Priority>('defaultPriority', 'medium'),
      defaultStatus: config.get<FeatureStatus>('defaultStatus', 'backlog')
    }

    this._panel.webview.postMessage({
      type: 'init',
      features: this._features,
      columns,
      settings
    })
  }
}
