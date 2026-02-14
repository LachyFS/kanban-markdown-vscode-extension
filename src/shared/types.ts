// Kanban types

export type Priority = 'critical' | 'high' | 'medium' | 'low'
export type FeatureStatus = 'backlog' | 'todo' | 'in-progress' | 'review' | 'done'

export interface GitHubMeta {
  issueNumber: number
  repo: string            // "owner/repo"
  htmlUrl: string
  syncedAt: string        // ISO timestamp of last sync
}

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
  order: number
  content: string
  filePath: string
  github?: GitHubMeta | null
}

// Parse title from the first # heading in markdown content
export function getTitleFromContent(content: string): string {
  const match = content.match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : 'Untitled'
}

// Generate a filename-safe slug from a title
export function generateFeatureFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, '') // Trim hyphens from start/end
    .slice(0, 50) // Limit length

  const now = new Date()
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return slug ? `${slug}-${date}` : `feature-${date}`
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

export interface GitHubReactions {
  '+1': number
  '-1': number
  laugh: number
  hooray: number
  confused: number
  heart: number
  rocket: number
  eyes: number
}

export interface GitHubComment {
  id: number
  author: string
  avatarUrl: string
  body: string
  createdAt: string
  reactions: GitHubReactions
}

export interface CardDisplaySettings {
  showPriorityBadges: boolean
  showAssignee: boolean
  showDueDate: boolean
  showLabels: boolean
  showBuildWithAI: boolean
  showFileName: boolean
  showGitHubBadge: boolean
  compactMode: boolean
  defaultPriority: Priority
  defaultStatus: FeatureStatus
}

// Messages between extension and webview
export type ExtensionMessage =
  | { type: 'init'; features: Feature[]; columns: KanbanColumn[]; settings: CardDisplaySettings }
  | { type: 'featuresUpdated'; features: Feature[] }
  | { type: 'triggerCreateDialog' }
  | { type: 'featureContent'; featureId: string; content: string; frontmatter: FeatureFrontmatter }
  | { type: 'syncStatus'; status: 'idle' | 'syncing' | 'success' | 'error'; message?: string }
  | { type: 'githubConnected'; connected: boolean; repo?: string }
  | { type: 'issueComments'; featureId: string; comments: GitHubComment[]; issueBody: string; issueAuthor: string; issueAuthorAvatar: string; issueCreatedAt: string; issueReactions: GitHubReactions }

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
  order: number
  github?: GitHubMeta | null
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
  | { type: 'syncGitHub' }
  | { type: 'unlinkGitHub' }
  | { type: 'openGitHubIssue'; url: string }
