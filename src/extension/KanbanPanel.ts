import * as vscode from 'vscode'
import * as crypto from 'crypto'
import * as path from 'path'
import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing'
import { getTitleFromContent, generateFeatureFilename } from '../shared/types'
import type { Feature, FeatureStatus, Priority, KanbanColumn, FeatureFrontmatter, CardDisplaySettings, FilenamePattern, AIAgent, AIPermissionMode, BoardViewMode } from '../shared/types'
import { ensureStatusSubfolders, moveFeatureFile, getFeatureFilePath, getStatusFromPath, fileExists } from './featureFileUtils'
import { parseFeatureFile, serializeFeature } from '../shared/featureFrontmatter'
import { featureMatchesEpicLane } from '../shared/epicLane'
import { t, getBundle, getEffectiveLocale, reloadBundle, getAllDefaultColumnNames, getDefaultColumnNamesForLocale } from './l10n'

function normalizeEpic(value: string | null | undefined): string | null {
  const t = value?.trim()
  return t ? t : null
}

interface CreateFeatureData {
  status: FeatureStatus
  priority: Priority
  content: string
  assignee: string | null
  epic: string | null
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
      t('panel.title'),
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
          case 'setBoardViewMode': {
            await this._context.workspaceState.update('kanban-markdown.boardViewMode', message.mode)
            break
          }
          case 'toggleEpicCollapsed': {
            const collapsedEpics: string[] = this._context.workspaceState.get('kanban-markdown.collapsedEpics', [])
            const idx = collapsedEpics.indexOf(message.epicKey)
            if (idx >= 0) {
              collapsedEpics.splice(idx, 1)
            } else {
              collapsedEpics.push(message.epicKey)
            }
            await this._context.workspaceState.update('kanban-markdown.collapsedEpics', collapsedEpics)
            break
          }
          case 'moveAllCards':
            await this._moveAllCards(message.sourceColumnId, message.targetColumnId, message.epicLane)
            break
          case 'archiveAllCards':
            await this._archiveAllCards(message.sourceColumnId)
            break
          case 'renameLabel':
            await this._renameLabel(message.oldName, message.newName)
            break
          case 'deleteLabel':
            await this._deleteLabel(message.labelName)
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
        if (e.affectsConfiguration('kanban-markdown.language')) {
          reloadBundle()
        }
        if (e.affectsConfiguration('kanban-markdown.featuresDirectory')) {
          // Features directory changed - need to reload everything
          this._setupFileWatcher()
          this._loadFeatures().then(() => this._sendFeaturesToWebview())
        } else {
          this._sendFeaturesToWebview()
          if (e.affectsConfiguration('kanban-markdown.filenamePattern')) {
            this._promptFilenamePatternMigration()
          }
          if (e.affectsConfiguration('kanban-markdown.language')) {
            this._promptColumnLanguageMigration()
          }
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
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src ${webview.cspSource} 'nonce-${nonce}';">
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
    return crypto.randomBytes(24).toString('base64url')
  }

  private _shellQuote(arg: string): string {
    return "'" + arg.replace(/'/g, "'\\''") + "'"
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
    return parseFeatureFile(content, filePath)
  }

  private _serializeFeature(feature: Feature): string {
    return serializeFeature(feature)
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
      vscode.window.showErrorMessage(t('panel.noWorkspace'))
      return
    }

    const title = getTitleFromContent(data.content)
    const config = vscode.workspace.getConfiguration('kanban-markdown')
    const pattern = config.get<FilenamePattern>('filenamePattern', 'name-date')
    const filename = generateFeatureFilename(title, pattern)
    const now = new Date().toISOString()
    const addNewCardsToTop = config.get<boolean>('addNewCardsToTop', false)
    const featuresInStatus = this._features
      .filter(f => f.status === data.status)
      .sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0))
    const newOrder = addNewCardsToTop
      ? generateKeyBetween(null, featuresInStatus.length > 0 ? featuresInStatus[0].order : null)
      : generateKeyBetween(featuresInStatus.length > 0 ? featuresInStatus[featuresInStatus.length - 1].order : null, null)

    let filePath = getFeatureFilePath(featuresDir, data.status, filename)
    let uniqueFilename = filename
    let counter = 1
    while (await fileExists(filePath)) {
      uniqueFilename = `${filename}-${counter}`
      filePath = getFeatureFilePath(featuresDir, data.status, uniqueFilename)
      counter++
    }

    const feature: Feature = {
      id: uniqueFilename,
      status: data.status,
      priority: data.priority,
      assignee: data.assignee,
      epic: normalizeEpic(data.epic),
      dueDate: data.dueDate,
      created: now,
      modified: now,
      completedAt: data.status === 'done' ? now : null,
      labels: data.labels,
      order: newOrder,
      content: data.content,
      filePath
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

  private async _moveAllCards(
    sourceColumnId: string,
    targetColumnId: string,
    epicLane?: string | null
  ): Promise<void> {
    const featuresDir = this._getWorkspaceFeaturesDir()
    if (!featuresDir) return

    const sourceFeatures = this._features
      .filter(f => f.status === sourceColumnId && featureMatchesEpicLane(f, epicLane))
      .sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0))
    if (sourceFeatures.length === 0) return

    const targetFeatures = this._features
      .filter(f => f.status === targetColumnId)
      .sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0))

    const lastTargetOrder = targetFeatures.length > 0 ? targetFeatures[targetFeatures.length - 1].order : null
    const newKeys = generateNKeysBetween(lastTargetOrder, null, sourceFeatures.length)

    const oldStatus = sourceColumnId
    const newStatus = targetColumnId as FeatureStatus
    const crossingDoneBoundary = oldStatus === 'done' || newStatus === 'done' as string

    this._migrating = crossingDoneBoundary
    try {
      for (let i = 0; i < sourceFeatures.length; i++) {
        const feature = sourceFeatures[i]
        feature.status = newStatus
        feature.modified = new Date().toISOString()
        feature.completedAt = newStatus === 'done' ? new Date().toISOString() : null
        feature.order = newKeys[i]

        const content = this._serializeFeature(feature)
        await vscode.workspace.fs.writeFile(vscode.Uri.file(feature.filePath), new TextEncoder().encode(content))

        if (crossingDoneBoundary) {
          try {
            const newPath = await moveFeatureFile(feature.filePath, featuresDir, targetColumnId)
            feature.filePath = newPath
          } catch {
            // Will reconcile on next load
          }
        }
      }
    } finally {
      this._migrating = false
    }

    this._sendFeaturesToWebview()
  }

  private async _archiveAllCards(sourceColumnId: string): Promise<void> {
    const featuresDir = this._getWorkspaceFeaturesDir()
    if (!featuresDir) return

    const sourceFeatures = this._features
      .filter(f => f.status === sourceColumnId)
    if (sourceFeatures.length === 0) return

    const count = sourceFeatures.length
    const archiveMsg = count === 1
      ? t('panel.archiveConfirmOne')
      : t('panel.archiveConfirmOther', { count })
    const archiveButton = t('panel.archiveButton')
    const confirm = await vscode.window.showWarningMessage(
      archiveMsg,
      { modal: true },
      archiveButton
    )
    if (confirm !== archiveButton) return

    const archivedDir = path.join(featuresDir, 'archived')
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(archivedDir))

    this._migrating = true
    const archivedIds = new Set<string>()
    let failedCount = 0
    try {
      for (const feature of sourceFeatures) {
        const filename = path.basename(feature.filePath)
        let targetPath = path.join(archivedDir, filename)

        // Handle filename collisions
        const ext = path.extname(filename)
        const base = path.basename(filename, ext)
        let counter = 1
        while (await fileExists(targetPath)) {
          targetPath = path.join(archivedDir, `${base}-${counter}${ext}`)
          counter++
        }

        try {
          await vscode.workspace.fs.rename(
            vscode.Uri.file(feature.filePath),
            vscode.Uri.file(targetPath)
          )
          archivedIds.add(feature.id)
        } catch {
          failedCount++
          continue
        }
      }
      this._features = this._features.filter(f => !archivedIds.has(f.id))
    } finally {
      this._migrating = false
    }

    if (failedCount > 0) {
      const failMsg = failedCount === 1
        ? t('panel.archiveFailedOne')
        : t('panel.archiveFailedOther', { count: failedCount })
      vscode.window.showWarningMessage(failMsg)
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
      vscode.window.showErrorMessage(t('panel.deleteFailed', { error: String(err) }))
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
      epic: feature.epic,
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
    feature.epic = normalizeEpic(frontmatter.epic)
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
    agent?: AIAgent,
    permissionMode?: AIPermissionMode
  ): Promise<void> {
    // Find the currently editing feature
    const feature = this._features.find(f => f.id === this._currentEditingFeatureId)
    if (!feature) {
      vscode.window.showErrorMessage(t('panel.noFeatureSelected'))
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

    let args: string[]

    switch (selectedAgent) {
      case 'claude': {
        args = []
        if (selectedPermissionMode !== 'default') {
          args.push('--permission-mode', selectedPermissionMode)
        }
        args.push(prompt)
        break
      }
      case 'codex': {
        const approvalMap: Record<string, string> = {
          'default': 'ask',
          'plan': 'ask',
          'acceptEdits': 'auto',
          'bypassPermissions': 'full-auto'
        }
        const approvalMode = approvalMap[selectedPermissionMode] || 'suggest'
        args = ['--ask-for-approval', approvalMode, prompt]
        break
      }
      case 'copilot': {
        args = [prompt]
        break
      }
      case 'opencode': {
        args = [prompt]
        break
      }
      default:
        args = [prompt]
    }

    const agentNames: Record<string, string> = {
      'claude': 'Claude Code',
      'codex': 'Codex',
      'copilot': 'GitHub Copilot',
      'opencode': 'OpenCode'
    }
    const terminal = vscode.window.createTerminal({
      name: agentNames[selectedAgent] || 'AI Agent',
      cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    })
    terminal.show()
    terminal.sendText([this._shellQuote(selectedAgent), ...args.map(a => this._shellQuote(a))].join(' '))
  }

  private async _deleteLabel(labelName: string): Promise<void> {
    const trimmed = labelName.trim()
    if (!trimmed) return

    const affectedFeatures = this._features.filter(f => f.labels.includes(trimmed))
    if (affectedFeatures.length === 0) return

    const count = affectedFeatures.length
    const removeMsg = count === 1
      ? t('panel.removeLabelOne', { label: trimmed })
      : t('panel.removeLabelOther', { label: trimmed, count })
    const removeButton = t('panel.removeButton')
    const confirm = await vscode.window.showWarningMessage(
      removeMsg,
      { modal: true },
      removeButton
    )
    if (confirm !== removeButton) return

    for (const feature of affectedFeatures) {
      const idx = feature.labels.indexOf(trimmed)
      if (idx !== -1) {
        feature.labels.splice(idx, 1)
        feature.modified = new Date().toISOString()

        const content = this._serializeFeature(feature)
        await vscode.workspace.fs.writeFile(vscode.Uri.file(feature.filePath), new TextEncoder().encode(content))
      }
    }

    this._sendFeaturesToWebview()
  }

  private async _renameLabel(oldName: string, newName: string): Promise<void> {
    const trimmedOld = oldName.trim()
    const trimmedNew = newName.trim()
    if (!trimmedOld || !trimmedNew || trimmedOld === trimmedNew) return

    let updatedCount = 0
    for (const feature of this._features) {
      const idx = feature.labels.indexOf(trimmedOld)
      if (idx === -1) continue

      // Replace old label with new, avoiding duplicates
      if (feature.labels.includes(trimmedNew)) {
        // New name already exists on this feature — just remove the old one
        feature.labels.splice(idx, 1)
      } else {
        feature.labels[idx] = trimmedNew
      }
      feature.modified = new Date().toISOString()

      const content = this._serializeFeature(feature)
      await vscode.workspace.fs.writeFile(vscode.Uri.file(feature.filePath), new TextEncoder().encode(content))
      updatedCount++
    }

    if (updatedCount > 0) {
      this._sendFeaturesToWebview()
    }
  }

  private async _promptFilenamePatternMigration(): Promise<void> {
    const count = this._features.length
    if (count === 0) return

    const filenameMsg = count === 1
      ? t('panel.filenameChangedOne')
      : t('panel.filenameChangedOther', { count })
    const renameButton = t('panel.renameButton')
    const answer = await vscode.window.showInformationMessage(
      filenameMsg,
      renameButton,
      t('panel.keepExisting')
    )
    if (answer !== renameButton) return

    await this._migrateFilenames()
  }

  private async _promptColumnLanguageMigration(): Promise<void> {
    const config = vscode.workspace.getConfiguration('kanban-markdown')
    const columns = config.get<KanbanColumn[]>('columns')
    if (!columns || columns.length === 0) return

    // Check if all column names are known defaults (from any locale)
    const knownDefaults = getAllDefaultColumnNames()
    const allAreDefaults = columns.every(col => knownDefaults.has(col.name))
    if (!allAreDefaults) return // User has custom column names, don't prompt

    // Check if columns already match the new locale
    const locale = getEffectiveLocale()
    const newNames = getDefaultColumnNamesForLocale(locale)
    const alreadyMatches = columns.every(col => col.name === newNames[col.id])
    if (alreadyMatches) return

    const updateButton = t('panel.updateColumns')
    const answer = await vscode.window.showInformationMessage(
      t('panel.languageChanged'),
      updateButton,
      t('panel.keepColumns')
    )
    if (answer !== updateButton) return

    const updatedColumns = columns.map(col => ({
      ...col,
      name: newNames[col.id] ?? col.name
    }))
    await config.update('columns', updatedColumns, vscode.ConfigurationTarget.Workspace)
  }

  private async _migrateFilenames(): Promise<void> {
    const featuresDir = this._getWorkspaceFeaturesDir()
    if (!featuresDir) return

    const config = vscode.workspace.getConfiguration('kanban-markdown')
    const pattern = config.get<FilenamePattern>('filenamePattern', 'name-date')

    let renamed = 0
    let skipped = 0

    this._migrating = true
    try {
      for (const feature of this._features) {
        const title = getTitleFromContent(feature.content)
        const createdDate = new Date(feature.created)
        const newFilename = generateFeatureFilename(title, pattern, createdDate)

        if (newFilename === feature.id) continue // no change needed

        const newFilePath = getFeatureFilePath(featuresDir, feature.status, newFilename)

        // Skip if target file already exists (collision)
        try {
          await vscode.workspace.fs.stat(vscode.Uri.file(newFilePath))
          skipped++
          continue
        } catch {
          // Target doesn't exist — safe to proceed
        }

        const oldPath = feature.filePath
        feature.id = newFilename
        feature.filePath = newFilePath

        const serialized = this._serializeFeature(feature)
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(newFilePath)))
        await vscode.workspace.fs.writeFile(vscode.Uri.file(newFilePath), new TextEncoder().encode(serialized))
        await vscode.workspace.fs.delete(vscode.Uri.file(oldPath))
        renamed++
      }
    } finally {
      this._migrating = false
    }

    await this._loadFeatures()
    this._sendFeaturesToWebview()

    const msg = skipped > 0
      ? t('panel.renameResultWithSkipped', { renamed, skipped })
      : t('panel.renameResult', { renamed })
    vscode.window.showInformationMessage(`Kanban Markdown: ${msg}`)
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
      showEpic: config.get<boolean>('showEpic', true),
      showBuildWithAI: config.get<boolean>('showBuildWithAI', true) && !vscode.workspace.getConfiguration('chat').get<boolean>('disableAIFeatures', false),
      showFileName: config.get<boolean>('showFileName', false),
      compactMode: config.get<boolean>('compactMode', false),
      markdownEditorMode: config.get<boolean>('markdownEditorMode', false),
      hideScrollbar: config.get<boolean>('hideScrollbar', false),
      defaultPriority: config.get<Priority>('defaultPriority', 'medium'),
      defaultStatus: config.get<FeatureStatus>('defaultStatus', 'backlog')
    }

    const collapsedColumns: string[] = this._context.workspaceState.get('kanban-markdown.collapsedColumns', [])
    const boardViewMode: BoardViewMode = this._context.workspaceState.get('kanban-markdown.boardViewMode', 'standard')
    const collapsedEpics: string[] = this._context.workspaceState.get('kanban-markdown.collapsedEpics', [])

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    const features = this._features.map(f => ({
      ...f,
      filePath: workspaceRoot ? path.relative(workspaceRoot, f.filePath) : f.filePath
    }))

    this._panel.webview.postMessage({
      type: 'init',
      features,
      columns,
      settings,
      collapsedColumns,
      boardViewMode,
      collapsedEpics,
      locale: getEffectiveLocale(),
      translations: getBundle()
    })
  }
}
