// Kanban types

export type Priority = 'critical' | 'high' | 'medium' | 'low'
export type FeatureStatus = 'backlog' | 'todo' | 'in-progress' | 'review' | 'done'

// AI agent types
export type AIAgent = 'claude' | 'codex' | 'opencode' | 'copilot'
export type AIPermissionMode = 'default' | 'plan' | 'acceptEdits' | 'bypassPermissions'

export interface Feature {
  id: string
  status: FeatureStatus
  priority: Priority
  assignee: string | null
  dueDate: string | null
  created: string
  modified: string
  completedAt: string | null
  labels: string[]
  order: string
  content: string
  filePath: string
}

// Parse title from the first # heading in markdown content, falling back to the first line
export function getTitleFromContent(content: string): string {
  const match = content.match(/^#\s+(.+)$/m)
  if (match) return match[1].trim()
  const firstLine = content.split('\n').map(l => l.trim()).find(l => l.length > 0)
  return firstLine || 'Untitled'
}

export type FilenamePattern = 'name-date' | 'date-name' | 'name-datetime' | 'datetime-name'

// Generate a filename-safe slug from a title
export function generateFeatureFilename(
  title: string,
  pattern: FilenamePattern = 'name-date',
  date: Date = new Date()
): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, '') // Trim hyphens from start/end
    .slice(0, 50) // Limit length

  const safeSlug = slug || 'feature'
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const timeStr = `${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}${String(date.getSeconds()).padStart(2, '0')}`

  switch (pattern) {
    case 'date-name':     return `${dateStr}-${safeSlug}`
    case 'name-datetime': return `${safeSlug}-${dateStr}-${timeStr}`
    case 'datetime-name': return `${dateStr}-${timeStr}-${safeSlug}`
    case 'name-date':
    default:              return `${safeSlug}-${dateStr}`
  }
}

export interface KanbanColumn {
  id: string
  name: string
  color: string
}

export const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: 'backlog', name: 'Backlog', color: '#6b7280' },
  { id: 'todo', name: 'To Do', color: '#3b82f6' },
  { id: 'in-progress', name: 'In Progress', color: '#f59e0b' },
  { id: 'review', name: 'Review', color: '#8b5cf6' },
  { id: 'done', name: 'Done', color: '#22c55e' }
]

export interface CardDisplaySettings {
  showPriorityBadges: boolean
  showAssignee: boolean
  showDueDate: boolean
  showLabels: boolean
  showBuildWithAI: boolean
  showFileName: boolean
  compactMode: boolean
  markdownEditorMode: boolean
  defaultPriority: Priority
  defaultStatus: FeatureStatus
}

// Messages between extension and webview
export type ExtensionMessage =
  | { type: 'init'; features: Feature[]; columns: KanbanColumn[]; settings: CardDisplaySettings; collapsedColumns: string[] }
  | { type: 'featuresUpdated'; features: Feature[] }
  | { type: 'triggerCreateDialog' }
  | { type: 'featureContent'; featureId: string; content: string; frontmatter: FeatureFrontmatter }

// Frontmatter for editing
export interface FeatureFrontmatter {
  id: string
  status: FeatureStatus
  priority: Priority
  assignee: string | null
  dueDate: string | null
  created: string
  modified: string
  completedAt: string | null
  labels: string[]
  order: string
}

export type WebviewMessage =
  | { type: 'ready' }
  | { type: 'createFeature'; data: { status: FeatureStatus; priority: Priority; content: string; assignee: string | null; dueDate: string | null; labels: string[] } }
  | { type: 'moveFeature'; featureId: string; newStatus: string; newOrder: number }
  | { type: 'deleteFeature'; featureId: string }
  | { type: 'updateFeature'; featureId: string; updates: Partial<Feature> }
  | { type: 'openFeature'; featureId: string }
  | { type: 'saveFeatureContent'; featureId: string; content: string; frontmatter: FeatureFrontmatter }
  | { type: 'closeFeature' }
  | { type: 'openFile'; featureId: string }
  | { type: 'openSettings' }
  | { type: 'toggleColumnCollapsed'; columnId: string }
  | { type: 'moveAllCards'; sourceColumnId: string; targetColumnId: string }
  | { type: 'archiveAllCards'; sourceColumnId: string }
  | { type: 'renameLabel'; oldName: string; newName: string }
  | { type: 'deleteLabel'; labelName: string }
