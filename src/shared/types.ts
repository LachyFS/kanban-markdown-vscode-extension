// Kanban types

export type Priority = 'critical' | 'high' | 'medium' | 'low'
export type FeatureStatus = 'backlog' | 'todo' | 'in-progress' | 'review' | 'done'

export interface Feature {
  id: string
  status: FeatureStatus
  priority: Priority
  assignee: string | null
  dueDate: string | null
  created: string
  modified: string
  labels: string[]
  order: number
  content: string
  filePath: string
}

// Parse title from the first # heading in markdown content
export function getTitleFromContent(content: string): string {
  const match = content.match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : 'Untitled'
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

// Messages between extension and webview
export type ExtensionMessage =
  | { type: 'init'; features: Feature[]; columns: KanbanColumn[] }
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
  labels: string[]
  order: number
}

export type WebviewMessage =
  | { type: 'ready' }
  | { type: 'createFeature'; data: { status: FeatureStatus; priority: Priority; content: string } }
  | { type: 'moveFeature'; featureId: string; newStatus: string; newOrder: number }
  | { type: 'deleteFeature'; featureId: string }
  | { type: 'updateFeature'; featureId: string; updates: Partial<Feature> }
  | { type: 'openFeature'; featureId: string }
  | { type: 'saveFeatureContent'; featureId: string; content: string; frontmatter: FeatureFrontmatter }
  | { type: 'closeFeature' }
