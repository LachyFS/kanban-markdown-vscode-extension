import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import { KanbanPanel } from './KanbanPanel'
import { SidebarViewProvider } from './SidebarViewProvider'
import { generateFeatureFilename } from '../shared/types'
import type { Feature, FeatureStatus, Priority } from '../shared/types'
import { ensureStatusSubfolders, getFeatureFilePath } from './featureFileUtils'

async function createFeatureFromPrompts(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('No workspace folder open')
    return
  }

  // Ask for title
  const title = await vscode.window.showInputBox({
    prompt: 'Feature title',
    placeHolder: 'Enter a title for the new feature'
  })
  if (!title) return

  // Ask for status
  const statusItems: vscode.QuickPickItem[] = [
    { label: 'Backlog', description: 'Not yet planned' },
    { label: 'To Do', description: 'Planned for development' },
    { label: 'In Progress', description: 'Currently being worked on' },
    { label: 'Review', description: 'Ready for review' },
    { label: 'Done', description: 'Completed' }
  ]
  const statusPick = await vscode.window.showQuickPick(statusItems, {
    placeHolder: 'Select initial status'
  })
  if (!statusPick) return

  const statusMap: Record<string, FeatureStatus> = {
    'Backlog': 'backlog',
    'To Do': 'todo',
    'In Progress': 'in-progress',
    'Review': 'review',
    'Done': 'done'
  }
  const status = statusMap[statusPick.label]

  // Ask for priority
  const priorityItems: vscode.QuickPickItem[] = [
    { label: 'Critical', description: 'Urgent, needs immediate attention' },
    { label: 'High', description: 'Important, should be done soon' },
    { label: 'Medium', description: 'Normal priority' },
    { label: 'Low', description: 'Nice to have, can wait' }
  ]
  const priorityPick = await vscode.window.showQuickPick(priorityItems, {
    placeHolder: 'Select priority'
  })
  if (!priorityPick) return

  const priority = priorityPick.label.toLowerCase() as Priority

  // Ask for description (optional)
  const description = await vscode.window.showInputBox({
    prompt: 'Description (optional)',
    placeHolder: 'Enter a description for the feature'
  })

  // Create the feature file
  const config = vscode.workspace.getConfiguration('kanban-markdown')
  const featuresDirectory = config.get<string>('featuresDirectory') || '.devtool/features'
  const featuresDir = path.join(workspaceFolders[0].uri.fsPath, featuresDirectory)
  await fs.promises.mkdir(featuresDir, { recursive: true })
  await ensureStatusSubfolders(featuresDir)

  const filename = generateFeatureFilename(title)
  const now = new Date().toISOString()

  // Build content with title as first # heading
  const content = `# ${title}${description ? '\n\n' + description : ''}`

  const feature: Feature = {
    id: filename,
    status,
    priority,
    assignee: null,
    dueDate: null,
    created: now,
    modified: now,
    labels: [],
    order: 0,
    content,
    filePath: getFeatureFilePath(featuresDir, status, filename)
  }

  const fileContent = serializeFeature(feature)
  await fs.promises.writeFile(feature.filePath, fileContent, 'utf-8')

  // Open the created file
  const document = await vscode.workspace.openTextDocument(feature.filePath)
  await vscode.window.showTextDocument(document)

  vscode.window.showInformationMessage(`Created feature: ${title}`)
}

function serializeFeature(feature: Feature): string {
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

export function activate(context: vscode.ExtensionContext) {
  // Sidebar webview in the activity bar
  const sidebarProvider = new SidebarViewProvider(context.extensionUri, context)
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarViewProvider.viewType, sidebarProvider)
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('kanban-markdown.open', () => {
      const wasOpen = !!KanbanPanel.currentPanel
      KanbanPanel.createOrShow(context.extensionUri, context)
      if (!wasOpen && KanbanPanel.currentPanel) {
        sidebarProvider.setBoardOpen(true)
        KanbanPanel.currentPanel.onDispose(() => {
          sidebarProvider.setBoardOpen(false)
        })
      }
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('kanban-markdown.addFeature', () => {
      createFeatureFromPrompts()
    })
  )

  // If a panel already exists, revive it
  if (vscode.window.registerWebviewPanelSerializer) {
    vscode.window.registerWebviewPanelSerializer(KanbanPanel.viewType, {
      async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel) {
        KanbanPanel.revive(webviewPanel, context.extensionUri, context)
        sidebarProvider.setBoardOpen(true)
        KanbanPanel.currentPanel?.onDispose(() => {
          sidebarProvider.setBoardOpen(false)
        })
      }
    })
  }
}

export function deactivate() {}
