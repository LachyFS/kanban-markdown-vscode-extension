// Editor types for WYSIWYG markdown editor

import type { Priority, FeatureStatus } from './types'

// Frontmatter extracted from feature markdown files
export interface FeatureFrontmatter {
  id: string
  title: string
  status: FeatureStatus
  priority: Priority
  assignee: string | null
  dueDate: string | null
  created: string
  modified: string
  labels: string[]
  order: number
}

// Messages from extension to editor webview
export type EditorExtensionMessage =
  | { type: 'init'; content: string; frontmatter: FeatureFrontmatter; fileName: string }
  | { type: 'contentChanged'; content: string }
  | { type: 'themeChanged'; isDark: boolean }

// AI coding agent types
export type AICodingAgent = 'claude' | 'codex' | 'opencode'

// Permission modes for AI agents
export type AIPermissionMode = 'default' | 'plan' | 'acceptEdits' | 'bypassPermissions'

// Messages from editor webview to extension
export type EditorWebviewMessage =
  | { type: 'ready' }
  | { type: 'contentUpdate'; content: string }
  | { type: 'frontmatterUpdate'; frontmatter: FeatureFrontmatter }
  | { type: 'requestSave' }
  | { type: 'startWithAI'; agent: AICodingAgent; permissionMode: AIPermissionMode }
