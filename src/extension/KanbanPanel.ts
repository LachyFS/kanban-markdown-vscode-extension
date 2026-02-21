import * as vscode from 'vscode'
import * as path from 'path'
import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing'
import { getTitleFromContent, generateFeatureFilename } from '../shared/types'
import type { Feature, FeatureStatus, Priority, KanbanColumn, FeatureFrontmatter, CardDisplaySettings } from '../shared/types'
import { ensureStatusSubfolders, moveFeatureFile, getFeatureFilePath, getStatusFromPath } from './featureFileUtils'

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
  private _lastWrittenContent: string = ''
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
          case 'createFeature': {
            await this._createFeature(message.data)
            const createConfig = vscode.workspace.getConfiguration('kanban-markdown')
            if (createConfig.get<boolean>('markdownEditorMode', false)) {
              // Open the newly created feature in native editor
              const created = this._features[this._features.length - 1]
              if (created) {
                this._openFeatureInNativeEditor(created.id)
              }
            }
            break
          }
          case 'moveFeature':
            await this._moveFeature(message.featureId, message.newStatus, message.newOrder)
            break
          case 'deleteFeature':
            await this._deleteFeature(message.featureId)
            break
          case 'updateFeature':
            await this._updateFeature(message.featureId, message.updates)
            break
          case 'openFeature': {
            const openConfig = vscode.workspace.getConfiguration('kanban-markdown')
            if (openConfig.get<boolean>('markdownEditorMode', false)) {
              this._openFeatureInNativeEditor(message.featureId)
            } else {
              await this._sendFeatureContent(message.featureId)
            }
            break
          }
          case 'saveFeatureContent':
            await this._saveFeatureContent(message.featureId, message.content, message.frontmatter)
            break
          case 'closeFeature':
            this._currentEditingFeatureId = null
            break
          case 'openFile': {
            const feat = this._features.find(f => f.id === message.featureId)
            if (feat) {
              const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(feat.filePath))
              await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside })
            }
            break
          }
          case 'openSettings':
            vscode.commands.executeCommand('workbench.action.openSettings', '@ext:LachyFS.kanban-markdown')
            break
          case 'focusMenuBar':
            // Focus must leave the webview before focusMenuBar works (VS Code limitation).
            // Use Activity Bar (not Side Bar) — it's always visible and won't expand a collapsed sidebar.
            await vscode.commands.executeCommand('workbench.action.focusActivityBar')
            await vscode.commands.executeCommand('workbench.action.focusMenuBar')
            break
          case 'toggleColumnCollapsed': {
            const collapsed: string[] = this._context.workspaceState.get('kanban-markdown.collapsedColumns', [])
            const idx = collapsed.indexOf(message.columnId)
            if (idx >= 0) {
              collapsed.splice(idx, 1)
            } else {
              collapsed.push(message.columnId)
            }
            await this._context.workspaceState.update('kanban-markdown.collapsedColumns', collapsed)
            break
          }
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

    const handleFileChange = (uri?: vscode.Uri) => {
      if (this._migrating) return
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(async () => {
        await this._loadFeatures()
        this._sendFeaturesToWebview()

        // If the changed file is the currently-edited feature, check for external changes
        if (this._currentEditingFeatureId && uri) {
          const editingFeature = this._features.find(f => f.id === this._currentEditingFeatureId)
          if (editingFeature && editingFeature.filePath === uri.fsPath) {
            const currentContent = this._serializeFeature(editingFeature)
            if (currentContent !== this._lastWrittenContent) {
              // External change detected — refresh the editor
              this._sendFeatureContent(this._currentEditingFeatureId)
            }
          }
        }
      }, 100)
    }

    this._fileWatcher.onDidChange((uri) => handleFileChange(uri), null, this._disposables)
    this._fileWatcher.onDidCreate((uri) => handleFileChange(uri), null, this._disposables)
    this._fileWatcher.onDidDelete((uri) => handleFileChange(uri), null, this._disposables)

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
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(featuresDir))
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
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(featuresDir))
      await ensureStatusSubfolders(featuresDir)

      // Phase 1: Migrate files from old per-status subfolders into new layout
      // Non-done subfolders (backlog/, todo/, in-progress/, review/) → move files to root
      // done/ files stay in done/
      // Root files with status: done → move to done/
      this._migrating = true
      try {
        const oldStatusFolders = ['backlog', 'todo', 'in-progress', 'review']
        for (const folder of oldStatusFolders) {
          const subdir = path.join(featuresDir, folder)
          try {
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(subdir))
            for (const [name, type] of entries) {
              if (type !== vscode.FileType.File || !name.endsWith('.md')) continue
              const filePath = path.join(subdir, name)
              try {
                const content = new TextDecoder().decode(await vscode.workspace.fs.readFile(vscode.Uri.file(filePath)))
                const feature = this._parseFeatureFile(content, filePath)
                const status = feature?.status || 'backlog'
                // Move to done/ if status is done, otherwise move to root
                await moveFeatureFile(filePath, featuresDir, status)
              } catch {
                // Skip files that fail to migrate
              }
            }
          } catch {
            // Old subfolder doesn't exist; skip
          }
        }

        // Remove old status folders if they are now empty
        for (const folder of oldStatusFolders) {
          const subdir = path.join(featuresDir, folder)
          try {
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(subdir))
            if (entries.length === 0) {
              await vscode.workspace.fs.delete(vscode.Uri.file(subdir))
            }
          } catch {
            // Folder doesn't exist or can't be read; skip
          }
        }

        // Also check root files that have status: done → move to done/
        const rootEntries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(featuresDir))
        for (const [name, type] of rootEntries) {
          if (type !== vscode.FileType.File || !name.endsWith('.md')) continue
          const filePath = path.join(featuresDir, name)
          try {
            const content = new TextDecoder().decode(await vscode.workspace.fs.readFile(vscode.Uri.file(filePath)))
            const feature = this._parseFeatureFile(content, filePath)
            if (feature?.status === 'done') {
              await moveFeatureFile(filePath, featuresDir, 'done')
            }
          } catch {
            // Skip files that fail to migrate
          }
        }
      } finally {
        this._migrating = false
      }

      // Phase 2: Load .md files from root (non-done) + done/ subfolder
      const features: Feature[] = []

      // Load root-level files
      const rootEntries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(featuresDir))
      for (const [file, fileType] of rootEntries) {
        if (fileType !== vscode.FileType.File || !file.endsWith('.md')) continue
        const filePath = path.join(featuresDir, file)
        const content = new TextDecoder().decode(await vscode.workspace.fs.readFile(vscode.Uri.file(filePath)))
        const feature = this._parseFeatureFile(content, filePath)
        if (feature) features.push(feature)
      }

      // Load done/ subfolder files
      const doneDir = path.join(featuresDir, 'done')
      try {
        const doneEntries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(doneDir))
        for (const [file, fileType] of doneEntries) {
          if (fileType !== vscode.FileType.File || !file.endsWith('.md')) continue
          const filePath = path.join(doneDir, file)
          const content = new TextDecoder().decode(await vscode.workspace.fs.readFile(vscode.Uri.file(filePath)))
          const feature = this._parseFeatureFile(content, filePath)
          if (feature) features.push(feature)
        }
      } catch {
        // done/ subfolder may not exist yet; skip
      }

      // Phase 3: Reconcile done ↔ non-done mismatches
      // Root file with status: done → move to done/
      // done/ file with non-done status → move to root
      this._migrating = true
      try {
        for (const feature of features) {
          const pathStatus = getStatusFromPath(feature.filePath, featuresDir)
          const inDoneFolder = pathStatus === 'done'
          const isDoneStatus = feature.status === 'done'

          if (isDoneStatus && !inDoneFolder) {
            try {
              const newPath = await moveFeatureFile(feature.filePath, featuresDir, 'done')
              feature.filePath = newPath
            } catch {
              // Will retry on next load
            }
          } else if (!isDoneStatus && inDoneFolder) {
            try {
              const newPath = await moveFeatureFile(feature.filePath, featuresDir, feature.status)
              feature.filePath = newPath
            } catch {
              // Will retry on next load
            }
          }
        }
      } finally {
        this._migrating = false
      }

      // Migrate legacy integer order values to fractional indices
      const hasLegacyOrder = features.some(f => /^\d+$/.test(f.order))
      if (hasLegacyOrder) {
        const byStatus = new Map<string, Feature[]>()
        for (const f of features) {
          const list = byStatus.get(f.status) || []
          list.push(f)
          byStatus.set(f.status, list)
        }

        const migrationWrites: Feature[] = []
        for (const columnFeatures of byStatus.values()) {
          columnFeatures.sort((a, b) => parseInt(a.order) - parseInt(b.order))
          const keys = generateNKeysBetween(null, null, columnFeatures.length)
          for (let i = 0; i < columnFeatures.length; i++) {
            columnFeatures[i].order = keys[i]
            migrationWrites.push(columnFeatures[i])
          }
        }

        for (const f of migrationWrites) {
          const content = this._serializeFeature(f)
          await vscode.workspace.fs.writeFile(vscode.Uri.file(f.filePath), new TextEncoder().encode(content))
        }
      }

      this._features = features.sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0))
    } catch {
      this._features = []
    }
  }

  private _parseFeatureFile(content: string, filePath: string): Feature | null {
    content = content.replace(/\r\n/g, '\n')
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
      completedAt: getValue('completedAt') || null,
      labels: getArrayValue('labels'),
      order: getValue('order') || 'a0',
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
      `completedAt: ${feature.completedAt ? `"${feature.completedAt}"` : 'null'}`,
      `labels: [${feature.labels.map(l => `"${l}"`).join(', ')}]`,
      `order: "${feature.order}"`,
      '---',
      ''
    ].join('\n')

    return frontmatter + feature.content
  }

  public triggerCreateDialog(): void {
    this._panel.webview.postMessage({ type: 'triggerCreateDialog' })
  }

  public openFeature(featureId: string): void {
    const config = vscode.workspace.getConfiguration('kanban-markdown')
    if (config.get<boolean>('markdownEditorMode', false)) {
      this._openFeatureInNativeEditor(featureId)
    } else {
      this._sendFeatureContent(featureId)
    }
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
    const featuresInStatus = this._features
      .filter(f => f.status === data.status)
      .sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0))
    const lastOrder = featuresInStatus.length > 0 ? featuresInStatus[featuresInStatus.length - 1].order : null

    const feature: Feature = {
      id: filename,
      status: data.status,
      priority: data.priority,
      assignee: data.assignee,
      dueDate: data.dueDate,
      created: now,
      modified: now,
      completedAt: data.status === 'done' ? now : null,
      labels: data.labels,
      order: generateKeyBetween(lastOrder, null),
      content: data.content,
      filePath: getFeatureFilePath(featuresDir, data.status, filename)
    }

    await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(feature.filePath)))
    const content = this._serializeFeature(feature)
    await vscode.workspace.fs.writeFile(vscode.Uri.file(feature.filePath), new TextEncoder().encode(content))

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

    // Update feature status
    feature.status = newStatus as FeatureStatus
    feature.modified = new Date().toISOString()
    if (statusChanged) {
      feature.completedAt = newStatus === 'done' ? new Date().toISOString() : null
    }

    // Get sorted features in the target column (excluding the moved feature)
    const targetColumnFeatures = this._features
      .filter(f => f.status === newStatus && f.id !== featureId)
      .sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0))

    // Compute fractional index between neighbors at the target position
    const clampedOrder = Math.max(0, Math.min(newOrder, targetColumnFeatures.length))
    const before = clampedOrder > 0 ? targetColumnFeatures[clampedOrder - 1].order : null
    const after = clampedOrder < targetColumnFeatures.length ? targetColumnFeatures[clampedOrder].order : null
    feature.order = generateKeyBetween(before, after)

    // Only the moved feature needs to be written
    const content = this._serializeFeature(feature)
    await vscode.workspace.fs.writeFile(vscode.Uri.file(feature.filePath), new TextEncoder().encode(content))

    // Only move file when crossing the done boundary
    const crossingDoneBoundary = statusChanged && (oldStatus === 'done' || newStatus === 'done')
    if (crossingDoneBoundary) {
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
      await vscode.workspace.fs.delete(vscode.Uri.file(feature.filePath))
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
    if (oldStatus !== feature.status) {
      feature.completedAt = feature.status === 'done' ? new Date().toISOString() : null
    }

    // Persist to file
    const content = this._serializeFeature(feature)
    await vscode.workspace.fs.writeFile(vscode.Uri.file(feature.filePath), new TextEncoder().encode(content))

    // Only move file when crossing the done boundary
    const crossingDoneBoundary = oldStatus !== feature.status && (oldStatus === 'done' || feature.status === 'done')
    if (crossingDoneBoundary) {
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

  private async _openFeatureInNativeEditor(featureId: string): Promise<void> {
    const feature = this._features.find(f => f.id === featureId)
    if (!feature) return

    // Use a fixed column beside the panel so repeated clicks reuse the same split
    const panelColumn = this._panel.viewColumn ?? vscode.ViewColumn.One
    const targetColumn = panelColumn === vscode.ViewColumn.One ? vscode.ViewColumn.Two : vscode.ViewColumn.Beside

    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(feature.filePath))
    await vscode.window.showTextDocument(doc, { viewColumn: targetColumn, preview: true })
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
      completedAt: feature.completedAt,
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
    if (oldStatus !== feature.status) {
      feature.completedAt = feature.status === 'done' ? new Date().toISOString() : null
    }

    // Save to file
    const fileContent = this._serializeFeature(feature)
    this._lastWrittenContent = fileContent
    await vscode.workspace.fs.writeFile(vscode.Uri.file(feature.filePath), new TextEncoder().encode(fileContent))

    // Only move file when crossing the done boundary
    const crossingDoneBoundary = oldStatus !== feature.status && (oldStatus === 'done' || feature.status === 'done')
    if (crossingDoneBoundary) {
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
      showLabels: config.get<boolean>('showLabels', true),
      showBuildWithAI: config.get<boolean>('showBuildWithAI', true) && !vscode.workspace.getConfiguration('chat').get<boolean>('disableAIFeatures', false),
      showFileName: config.get<boolean>('showFileName', false),
      compactMode: config.get<boolean>('compactMode', false),
      markdownEditorMode: config.get<boolean>('markdownEditorMode', false),
      defaultPriority: config.get<Priority>('defaultPriority', 'medium'),
      defaultStatus: config.get<FeatureStatus>('defaultStatus', 'backlog')
    }

    const collapsedColumns: string[] = this._context.workspaceState.get('kanban-markdown.collapsedColumns', [])

    this._panel.webview.postMessage({
      type: 'init',
      features: this._features,
      columns,
      settings,
      collapsedColumns
    })
  }
}
