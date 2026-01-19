import type { FeatureFrontmatter } from './types'

export type { FeatureFrontmatter }

// Messages from the extension to the editor webview
export type EditorExtensionMessage =
  | { type: 'init'; content: string; frontmatter: FeatureFrontmatter | null; fileName: string }

// Messages from the editor webview to the extension
export type EditorWebviewMessage =
  | { type: 'ready' }
  | { type: 'frontmatterUpdate'; frontmatter: FeatureFrontmatter }
  | { type: 'requestSave' }
  | { type: 'startWithAI'; agent?: 'claude' | 'codex' | 'opencode'; permissionMode?: 'default' | 'plan' | 'acceptEdits' | 'bypassPermissions' }
