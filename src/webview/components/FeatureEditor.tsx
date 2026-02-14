import { useEffect, useCallback, useState, useRef, useMemo } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from 'tiptap-markdown'
import { X, User, ChevronDown, Wand2, Tag, Plus, Check, CircleDot, Signal, Calendar, Trash2, FileText, MessageSquare } from 'lucide-react'
import type { FeatureFrontmatter, Priority, FeatureStatus, GitHubComment, GitHubReactions } from '../../shared/types'
import { cn } from '../lib/utils'
import { useStore } from '../store'

interface MarkdownStorage {
  markdown: { getMarkdown: () => string }
}

function getMarkdown(editor: { storage: unknown }): string {
  return (editor.storage as MarkdownStorage).markdown.getMarkdown()
}

type AIAgent = 'claude' | 'codex' | 'opencode'
type PermissionMode = 'default' | 'plan' | 'acceptEdits' | 'bypassPermissions'

interface IssueCommentsData {
  featureId: string
  comments: GitHubComment[]
  issueBody: string
  issueAuthor: string
  issueAuthorAvatar: string
  issueCreatedAt: string
  issueReactions: GitHubReactions
}

interface FeatureEditorProps {
  featureId: string
  content: string
  frontmatter: FeatureFrontmatter
  contentVersion?: number
  issueComments?: IssueCommentsData | null
  onSave: (content: string, frontmatter: FeatureFrontmatter) => void
  onClose: () => void
  onDelete: () => void
  onOpenFile: () => void
  onStartWithAI: (agent: AIAgent, permissionMode: PermissionMode) => void
  onOpenGitHubIssue?: (url: string) => void
}

const priorityLabels: Record<Priority, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low'
}

const statusLabels: Record<FeatureStatus, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  'in-progress': 'In Progress',
  review: 'Review',
  done: 'Done'
}

const priorities: Priority[] = ['critical', 'high', 'medium', 'low']
const statuses: FeatureStatus[] = ['backlog', 'todo', 'in-progress', 'review', 'done']

const priorityDots: Record<Priority, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
}

const statusDots: Record<FeatureStatus, string> = {
  backlog: 'bg-zinc-400',
  todo: 'bg-blue-400',
  'in-progress': 'bg-amber-400',
  review: 'bg-purple-400',
  done: 'bg-emerald-400',
}

const aiAgentTabs: { agent: AIAgent; label: string; color: string; activeColor: string }[] = [
  { agent: 'claude', label: 'Claude', color: 'hover:bg-amber-100 dark:hover:bg-amber-900/30', activeColor: 'bg-amber-700 text-white' },
  { agent: 'codex', label: 'Codex', color: 'hover:bg-emerald-100 dark:hover:bg-emerald-900/30', activeColor: 'bg-emerald-500 text-white' },
  { agent: 'opencode', label: 'OpenCode', color: 'hover:bg-slate-100 dark:hover:bg-slate-700/30', activeColor: 'bg-slate-500 text-white' },
]

const agentButtonColors: Record<AIAgent, { bg: string; hover: string; shadow: string; border: string }> = {
  claude: {
    bg: 'bg-amber-700',
    hover: 'hover:bg-amber-800',
    shadow: 'shadow-sm',
    border: 'border border-amber-800/50'
  },
  codex: {
    bg: 'bg-emerald-600',
    hover: 'hover:bg-emerald-700',
    shadow: 'shadow-sm',
    border: 'border border-emerald-700/50'
  },
  opencode: {
    bg: 'bg-slate-600',
    hover: 'hover:bg-slate-700',
    shadow: 'shadow-sm',
    border: 'border border-slate-700/50'
  },
}

const aiModesByAgent: Record<AIAgent, { permissionMode: PermissionMode; label: string; description: string }[]> = {
  claude: [
    { permissionMode: 'default', label: 'Default', description: 'With confirmations' },
    { permissionMode: 'plan', label: 'Plan', description: 'Creates a plan first' },
    { permissionMode: 'acceptEdits', label: 'Auto-edit', description: 'Auto-accepts file edits' },
    { permissionMode: 'bypassPermissions', label: 'Full Auto', description: 'Bypasses all prompts' },
  ],
  codex: [
    { permissionMode: 'default', label: 'Suggest', description: 'Suggests changes' },
    { permissionMode: 'acceptEdits', label: 'Auto-edit', description: 'Auto-accepts edits' },
    { permissionMode: 'bypassPermissions', label: 'Full Auto', description: 'Full automation' },
  ],
  opencode: [
    { permissionMode: 'default', label: 'Default', description: 'Standard mode' },
  ],
}

interface DropdownProps {
  value: string
  options: { value: string; label: string; dot?: string }[]
  onChange: (value: string) => void
  className?: string
}

function Dropdown({ value, options, onChange, className }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const current = options.find(o => o.value === value)

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2 py-1 text-xs font-medium rounded transition-colors vscode-hover-bg"
        style={{ color: 'var(--vscode-foreground)' }}
      >
        {current?.dot && <span className={cn('w-2 h-2 rounded-full shrink-0', current.dot)} />}
        <span>{current?.label}</span>
        <ChevronDown size={12} style={{ color: 'var(--vscode-descriptionForeground)' }} className="ml-0.5" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div
            className="absolute top-full left-0 mt-1 z-20 rounded-lg shadow-lg py-1 min-w-[140px]"
            style={{
              background: 'var(--vscode-dropdown-background)',
              border: '1px solid var(--vscode-dropdown-border, var(--vscode-panel-border))',
            }}
          >
            {options.map(option => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors"
                style={{
                  color: 'var(--vscode-dropdown-foreground)',
                  background: option.value === value ? 'var(--vscode-list-activeSelectionBackground)' : undefined,
                }}
                onMouseEnter={e => {
                  if (option.value !== value) e.currentTarget.style.background = 'var(--vscode-list-hoverBackground)'
                }}
                onMouseLeave={e => {
                  if (option.value !== value) e.currentTarget.style.background = 'transparent'
                }}
              >
                {option.dot && <span className={cn('w-2 h-2 rounded-full shrink-0', option.dot)} />}
                <span className="flex-1 text-left">{option.label}</span>
                {option.value === value && <Check size={12} style={{ color: 'var(--vscode-focusBorder)' }} className="shrink-0" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function PropertyRow({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-[5px] transition-colors vscode-hover-bg"
    >
      <div className="flex items-center gap-2 w-[90px] shrink-0">
        <span style={{ color: 'var(--vscode-descriptionForeground)' }}>{icon}</span>
        <span className="text-[11px]" style={{ color: 'var(--vscode-descriptionForeground)' }}>{label}</span>
      </div>
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  )
}

interface AIDropdownProps {
  onSelect: (agent: AIAgent, permissionMode: PermissionMode) => void
}

function AIDropdown({ onSelect }: AIDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedTab, setSelectedTab] = useState<AIAgent>('claude')

  const modes = aiModesByAgent[selectedTab]
  const buttonColors = agentButtonColors[selectedTab]

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-white rounded-md transition-colors',
          buttonColors.bg,
          buttonColors.hover,
          buttonColors.shadow,
          buttonColors.border
        )}
      >
        <Wand2 size={13} />
        <span>Build with AI</span>
        <kbd className="ml-0.5 text-[9px] opacity-60 font-mono">⌘B</kbd>
        <ChevronDown size={11} className={cn('ml-0.5 opacity-60 transition-transform', isOpen && 'rotate-180')} />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full right-0 mt-1 z-20 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl min-w-[260px] overflow-hidden">
            {/* Tabs */}
            <div className="flex">
              {aiAgentTabs.map((tab) => (
                <button
                  key={tab.agent}
                  onClick={() => setSelectedTab(tab.agent)}
                  className={cn(
                    'flex-1 px-3 py-2.5 text-xs font-medium transition-all',
                    selectedTab === tab.agent
                      ? tab.activeColor
                      : cn('text-zinc-600 dark:text-zinc-400', tab.color)
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {/* Options */}
            <div className="p-2 space-y-1">
              {modes.map((mode) => (
                <button
                  key={mode.permissionMode}
                  onClick={() => {
                    onSelect(selectedTab, mode.permissionMode)
                    setIsOpen(false)
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700/50 transition-colors"
                >
                  <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100">{mode.label}</div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">{mode.description}</div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function LabelEditor({ labels, onChange }: { labels: string[]; onChange: (labels: string[]) => void }) {
  const [newLabel, setNewLabel] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const features = useStore(s => s.features)

  const existingLabels = useMemo(() => {
    const labelSet = new Set<string>()
    features.forEach(f => f.labels.forEach(l => labelSet.add(l)))
    return Array.from(labelSet).sort()
  }, [features])

  const suggestions = useMemo(() => {
    const available = existingLabels.filter(l => !labels.includes(l))
    if (!newLabel.trim()) return available
    return available.filter(l => l.toLowerCase().includes(newLabel.toLowerCase()))
  }, [newLabel, existingLabels, labels])

  const showSuggestions = isFocused && suggestions.length > 0

  const addLabel = (label?: string) => {
    const l = (label || newLabel).trim()
    if (l && !labels.includes(l)) {
      onChange([...labels, l])
    }
    setNewLabel('')
  }

  const removeLabel = (label: string) => {
    onChange(labels.filter(l => l !== label))
  }

  return (
    <div className="relative flex items-center gap-1.5 flex-wrap">
      {labels.map(label => (
        <span
          key={label}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded"
          style={{
            background: 'var(--vscode-badge-background)',
            color: 'var(--vscode-badge-foreground)',
          }}
        >
          {label}
          <button
            onClick={() => removeLabel(label)}
            className="hover:text-red-500 transition-colors"
          >
            <X size={9} />
          </button>
        </span>
      ))}
      <button
        onClick={() => { setIsFocused(true); setTimeout(() => inputRef.current?.focus(), 0) }}
        className="inline-flex items-center gap-0.5 px-1 py-0.5 text-[10px] rounded transition-colors vscode-hover-bg"
        style={{ color: 'var(--vscode-descriptionForeground)' }}
      >
        <Plus size={10} />
      </button>
      <input
        ref={inputRef}
        type="text"
        value={newLabel}
        onChange={(e) => setNewLabel(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setTimeout(() => setIsFocused(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); addLabel() }
          if (e.key === 'Backspace' && !newLabel && labels.length > 0) {
            onChange(labels.slice(0, -1))
          }
          if (e.key === 'Escape') { setNewLabel(''); inputRef.current?.blur() }
        }}
        placeholder={labels.length === 0 ? 'Add labels...' : ''}
        className="flex-1 min-w-[60px] bg-transparent border-none outline-none text-xs"
        style={{ color: 'var(--vscode-foreground)', display: isFocused || newLabel ? 'block' : 'none' }}
      />
      {showSuggestions && (
        <div
          className="absolute top-full left-0 mt-1 z-20 rounded-lg shadow-lg py-1 max-h-[160px] overflow-auto min-w-[180px]"
          style={{
            background: 'var(--vscode-dropdown-background)',
            border: '1px solid var(--vscode-dropdown-border, var(--vscode-panel-border))',
          }}
        >
          {suggestions.map(label => (
            <button
              key={label}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); addLabel(label) }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors"
              style={{ color: 'var(--vscode-dropdown-foreground)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--vscode-list-hoverBackground)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span
                className="inline-block px-1.5 py-0.5 text-[10px] font-medium rounded"
                style={{
                  background: 'var(--vscode-badge-background)',
                  color: 'var(--vscode-badge-foreground)',
                }}
              >{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const seconds = Math.floor((now - then) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`
  const years = Math.floor(months / 12)
  return `${years} year${years !== 1 ? 's' : ''} ago`
}

function renderMarkdown(md: string): string {
  let s = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Fenced code blocks
  s = s.replace(/```\w*\n([\s\S]*?)```/g, (_, code: string) =>
    `<pre style="background:var(--vscode-textCodeBlock-background);padding:8px 12px;border-radius:6px;overflow-x:auto;margin:8px 0;font-family:var(--vscode-editor-font-family);font-size:12px;line-height:1.45"><code>${code.trimEnd()}</code></pre>`
  )

  // Inline code
  s = s.replace(/`([^`\n]+)`/g,
    '<code style="background:var(--vscode-textCodeBlock-background);padding:1px 5px;border-radius:3px;font-family:var(--vscode-editor-font-family);font-size:0.9em">$1</code>'
  )

  // Bold
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

  // Links — only http/https
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a style="color:var(--vscode-textLink-foreground);text-decoration:underline" href="$2">$1</a>'
  )

  // Blockquotes (lines starting with >)
  s = s.replace(/^&gt;\s?(.*)$/gm,
    '<span style="display:block;border-left:3px solid var(--vscode-panel-border);padding-left:10px;color:var(--vscode-descriptionForeground)">$1</span>'
  )

  // Line breaks
  s = s.replace(/\n/g, '<br>')

  return s
}

const reactionEmoji: Record<string, string> = {
  '+1': '\u{1F44D}',
  '-1': '\u{1F44E}',
  laugh: '\u{1F604}',
  hooray: '\u{1F389}',
  confused: '\u{1F615}',
  heart: '\u{2764}\u{FE0F}',
  rocket: '\u{1F680}',
  eyes: '\u{1F440}',
}

function ReactionBar({ reactions }: { reactions: GitHubReactions }) {
  const entries = Object.entries(reactions).filter(
    ([key, count]) => count > 0 && key in reactionEmoji
  ) as [string, number][]

  if (entries.length === 0) return null

  return (
    <div className="flex items-center gap-1 flex-wrap mt-2 pt-2" style={{ borderTop: '1px solid var(--vscode-panel-border)' }}>
      {entries.map(([key, count]) => (
        <span
          key={key}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px]"
          style={{
            background: 'var(--vscode-badge-background)',
            color: 'var(--vscode-badge-foreground)',
            opacity: 0.9,
          }}
        >
          <span>{reactionEmoji[key]}</span>
          <span className="font-medium">{count}</span>
        </span>
      ))}
    </div>
  )
}

function CommentCard({ author, avatarUrl, body, createdAt, showTimeline, reactions }: {
  author: string; avatarUrl: string; body: string; createdAt: string; showTimeline: boolean; reactions: GitHubReactions
}) {
  const borderColor = 'var(--vscode-panel-border)'
  const headerBg = 'var(--vscode-sideBarSectionHeader-background, rgba(128,128,128,0.08))'

  return (
    <div className="flex gap-3 relative">
      {/* Avatar + timeline */}
      <div className="flex flex-col items-center shrink-0 w-8">
        {avatarUrl ? (
          <img src={avatarUrl} alt={author} className="w-8 h-8 rounded-full object-cover relative z-[1]" />
        ) : (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold relative z-[1]"
            style={{ background: 'var(--vscode-badge-background)', color: 'var(--vscode-badge-foreground)' }}
          >
            {author.charAt(0).toUpperCase()}
          </div>
        )}
        {showTimeline && (
          <div className="flex-1 w-px mt-1" style={{ background: borderColor }} />
        )}
      </div>

      {/* Comment bubble */}
      <div className="flex-1 min-w-0 pb-4 relative">
        {/* Speech bubble arrow */}
        <div
          className="absolute top-[10px] -left-[8px] w-0 h-0"
          style={{
            borderTop: '8px solid transparent',
            borderBottom: '8px solid transparent',
            borderRight: `8px solid ${borderColor}`,
          }}
        />
        <div
          className="absolute top-[10px] -left-[7px] w-0 h-0"
          style={{
            borderTop: '8px solid transparent',
            borderBottom: '8px solid transparent',
            borderRight: '8px solid var(--vscode-editor-background)',
          }}
        />

        <div className="rounded-md overflow-hidden" style={{ border: `1px solid ${borderColor}` }}>
          {/* Header */}
          <div
            className="px-3 py-1.5 flex items-center gap-1 text-xs"
            style={{ background: headerBg, borderBottom: `1px solid ${borderColor}` }}
          >
            <span className="font-semibold" style={{ color: 'var(--vscode-foreground)' }}>{author}</span>
            <span style={{ color: 'var(--vscode-descriptionForeground)' }}>commented {relativeTime(createdAt)}</span>
          </div>

          {/* Body */}
          <div className="px-3 py-3">
            {body ? (
              <div
                className="text-[13px] leading-relaxed break-words"
                style={{ color: 'var(--vscode-foreground)' }}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }}
              />
            ) : (
              <p className="text-xs italic m-0" style={{ color: 'var(--vscode-descriptionForeground)' }}>No description provided.</p>
            )}
            <ReactionBar reactions={reactions} />
          </div>
        </div>
      </div>
    </div>
  )
}

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn('rounded animate-pulse', className)}
      style={{ background: 'var(--vscode-editor-inactiveSelectionBackground, rgba(128,128,128,0.12))' }}
    />
  )
}

function CommentCardSkeleton({ showTimeline }: { showTimeline: boolean }) {
  const borderColor = 'var(--vscode-panel-border)'
  const headerBg = 'var(--vscode-sideBarSectionHeader-background, rgba(128,128,128,0.08))'

  return (
    <div className="flex gap-3 relative">
      <div className="flex flex-col items-center shrink-0 w-8">
        <SkeletonBlock className="w-8 h-8 rounded-full" />
        {showTimeline && (
          <div className="flex-1 w-px mt-1" style={{ background: borderColor }} />
        )}
      </div>
      <div className="flex-1 min-w-0 pb-4">
        <div className="rounded-md overflow-hidden" style={{ border: `1px solid ${borderColor}` }}>
          <div className="px-3 py-2 flex items-center gap-2" style={{ background: headerBg, borderBottom: `1px solid ${borderColor}` }}>
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="h-3 w-28" />
          </div>
          <div className="px-3 py-3 space-y-2">
            <SkeletonBlock className="h-3 w-full" />
            <SkeletonBlock className="h-3 w-4/5" />
            <SkeletonBlock className="h-3 w-3/5" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function FeatureEditor({ featureId, content, frontmatter, contentVersion, issueComments, onSave, onClose, onDelete, onOpenFile, onStartWithAI, onOpenGitHubIssue }: FeatureEditorProps) {
  const { cardSettings } = useStore()
  const [currentFrontmatter, setCurrentFrontmatter] = useState(frontmatter)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [conversationOpen, setConversationOpen] = useState(true)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitialLoad = useRef(true)
  const currentFrontmatterRef = useRef(currentFrontmatter)
  currentFrontmatterRef.current = currentFrontmatter

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing...' }),
      Markdown.configure({ html: false, transformPastedText: true })
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[200px] p-4'
      }
    },
    onUpdate: ({ editor: ed }) => {
      if (isInitialLoad.current) return
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const markdown = getMarkdown(ed)
        onSave(markdown, currentFrontmatterRef.current)
      }, 800)
    }
  })

  const save = useCallback(() => {
    if (!editor) return
    const markdown = getMarkdown(editor)
    onSave(markdown, currentFrontmatter)
  }, [editor, currentFrontmatter, onSave])

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // Set content when a new feature is opened (keyed by featureId, not content)
  useEffect(() => {
    if (editor && content) {
      isInitialLoad.current = true
      editor.commands.setContent(content)
      // Allow a tick for the onUpdate from setContent to fire, then re-enable
      requestAnimationFrame(() => { isInitialLoad.current = false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, featureId, contentVersion])

  // Reset frontmatter when prop changes
  useEffect(() => {
    setCurrentFrontmatter(frontmatter)
  }, [frontmatter])

  const handleFrontmatterUpdate = useCallback((updates: Partial<FeatureFrontmatter>) => {
    setCurrentFrontmatter(prev => {
      const next = { ...prev, ...updates }
      // Schedule a save with the updated frontmatter
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        if (!editor) return
        const markdown = getMarkdown(editor)
        onSave(markdown, next)
      }, 800)
      return next
    })
  }, [editor, onSave])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        // Flush any pending debounce and save immediately
        if (debounceRef.current) clearTimeout(debounceRef.current)
        save()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'b' && cardSettings.showBuildWithAI) {
        e.preventDefault()
        onStartWithAI('claude', 'default')
      }
      if (e.key === 'Escape') {
        // Flush any pending save before closing
        if (debounceRef.current) {
          clearTimeout(debounceRef.current)
          save()
        }
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [save, onClose, onStartWithAI, cardSettings.showBuildWithAI])

  return (
    <div
      className="h-full flex flex-col"
      style={{
        background: 'var(--vscode-editor-background)',
        borderLeft: '1px solid var(--vscode-panel-border)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--vscode-panel-border)' }}
      >
        <div className="flex items-center gap-3">
          {currentFrontmatter.github ? (
            <span className="flex items-center gap-1.5 text-xs font-mono" style={{ color: 'var(--vscode-descriptionForeground)' }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
              #{currentFrontmatter.github.issueNumber}
            </span>
          ) : (
            <span className="text-xs font-mono" style={{ color: 'var(--vscode-descriptionForeground)' }}>{featureId}</span>
          )}
          {confirmingDelete ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs" style={{ color: 'var(--vscode-errorForeground)' }}>Delete?</span>
              <button
                onClick={() => { setConfirmingDelete(false); onDelete() }}
                className="px-2 py-1 text-xs font-medium rounded transition-colors text-white bg-red-600 hover:bg-red-700"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="px-2 py-1 text-xs font-medium rounded transition-colors vscode-hover-bg"
                style={{ color: 'var(--vscode-foreground)' }}
              >
                No
              </button>
            </div>
          ) : (
            <>
              {currentFrontmatter.github && onOpenGitHubIssue ? (
                <button
                  onClick={() => onOpenGitHubIssue(currentFrontmatter.github!.htmlUrl)}
                  className="p-1.5 px-2 rounded border transition-colors vscode-hover-bg flex items-center gap-1"
                  style={{ color: 'var(--vscode-descriptionForeground)', borderColor: 'var(--vscode-widget-border, var(--vscode-contrastBorder, rgba(128,128,128,0.35)))' }}
                  title="Open on GitHub"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
                  <span className="text-xs">OPEN</span>
                </button>
              ) : (
                <button
                  onClick={() => { onOpenFile(); onClose(); }}
                  className="p-1.5 px-2 rounded border transition-colors vscode-hover-bg flex items-center gap-1"
                  style={{ color: 'var(--vscode-descriptionForeground)', borderColor: 'var(--vscode-widget-border, var(--vscode-contrastBorder, rgba(128,128,128,0.35)))' }}
                  title="Open .md file"
                >
                  <FileText size={16} />
                  <span className="text-xs">OPEN</span>
                </button>
              )}
              <button
                onClick={() => setConfirmingDelete(true)}
                className="p-1.5 px-2 rounded border transition-colors vscode-hover-bg flex items-center gap-1"
                style={{ color: 'var(--vscode-descriptionForeground)', borderColor: 'var(--vscode-widget-border, var(--vscode-contrastBorder, rgba(128,128,128,0.35)))' }}
                title="Delete ticket"
              >
                <Trash2 size={16} />
                <span className="text-xs">DELETE</span>
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {cardSettings.showBuildWithAI && <AIDropdown onSelect={onStartWithAI} />}
          <button
            onClick={onClose}
            className="p-1.5 rounded transition-colors vscode-hover-bg"
            style={{ color: 'var(--vscode-descriptionForeground)' }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Metadata */}
      <div
        className="flex flex-col py-0.5"
        style={{ borderBottom: '1px solid var(--vscode-panel-border)' }}
      >
        <PropertyRow label="Status" icon={<CircleDot size={13} />}>
          <Dropdown
            value={currentFrontmatter.status}
            options={statuses.map(s => ({ value: s, label: statusLabels[s], dot: statusDots[s] }))}
            onChange={(v) => handleFrontmatterUpdate({ status: v as FeatureStatus })}
          />
        </PropertyRow>
        {cardSettings.showPriorityBadges && (
          <PropertyRow label="Priority" icon={<Signal size={13} />}>
            <Dropdown
              value={currentFrontmatter.priority}
              options={priorities.map(p => ({ value: p, label: priorityLabels[p], dot: priorityDots[p] }))}
              onChange={(v) => handleFrontmatterUpdate({ priority: v as Priority })}
            />
          </PropertyRow>
        )}
        {cardSettings.showAssignee && (
          <PropertyRow label="Assignee" icon={<User size={13} />}>
            <div className="flex items-center gap-2">
              {currentFrontmatter.assignee && (
                <span
                  className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold"
                  style={{
                    background: 'var(--vscode-badge-background)',
                    color: 'var(--vscode-badge-foreground)',
                  }}
                >{currentFrontmatter.assignee.split(/\s+/).filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2)}</span>
              )}
              <input
                type="text"
                value={currentFrontmatter.assignee || ''}
                onChange={(e) => handleFrontmatterUpdate({ assignee: e.target.value || null })}
                placeholder="No assignee"
                className="bg-transparent border-none outline-none text-xs w-32"
                style={{ color: currentFrontmatter.assignee ? 'var(--vscode-foreground)' : 'var(--vscode-descriptionForeground)' }}
              />
            </div>
          </PropertyRow>
        )}
        {cardSettings.showDueDate && (
          <PropertyRow label="Due date" icon={<Calendar size={13} />}>
            <input
              type="date"
              value={currentFrontmatter.dueDate || ''}
              onChange={(e) => handleFrontmatterUpdate({ dueDate: e.target.value || null })}
              className="bg-transparent border-none outline-none text-xs"
              style={{ color: currentFrontmatter.dueDate ? 'var(--vscode-foreground)' : 'var(--vscode-descriptionForeground)' }}
            />
          </PropertyRow>
        )}
        {cardSettings.showLabels && (
        <PropertyRow label="Labels" icon={<Tag size={13} />}>
          <LabelEditor
            labels={currentFrontmatter.labels}
            onChange={(labels) => handleFrontmatterUpdate({ labels })}
          />
        </PropertyRow>
        )}
      </div>

      {/* Editor + Conversation */}
      <div className="flex-1 overflow-auto">
        <EditorContent editor={editor} />

        {/* Conversation thread (GitHub-synced features only) */}
        {currentFrontmatter.github && (
          <div style={{ borderTop: '1px solid var(--vscode-panel-border)' }}>
            <button
              onClick={() => setConversationOpen(prev => !prev)}
              className="flex items-center gap-2 w-full px-4 py-2.5 text-xs font-medium transition-colors vscode-hover-bg"
              style={{ color: 'var(--vscode-foreground)' }}
            >
              <ChevronDown size={12} className={cn('transition-transform', !conversationOpen && '-rotate-90')} />
              <MessageSquare size={13} style={{ color: 'var(--vscode-descriptionForeground)' }} />
              <span>
                {issueComments
                  ? `Conversation (${issueComments.comments.length + 1})`
                  : 'Conversation'
                }
              </span>
              {!issueComments && (
                <span className="inline-block w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--vscode-descriptionForeground)', borderTopColor: 'transparent' }} />
              )}
            </button>
            {conversationOpen && (
              <div className="px-4 pb-4">
                {issueComments ? (
                  <>
                    <CommentCard
                      author={issueComments.issueAuthor}
                      avatarUrl={issueComments.issueAuthorAvatar}
                      body={issueComments.issueBody}
                      createdAt={issueComments.issueCreatedAt}
                      showTimeline={issueComments.comments.length > 0}
                      reactions={issueComments.issueReactions}
                    />
                    {issueComments.comments.map((comment, i) => (
                      <CommentCard
                        key={comment.id}
                        author={comment.author}
                        avatarUrl={comment.avatarUrl}
                        body={comment.body}
                        createdAt={comment.createdAt}
                        showTimeline={i < issueComments.comments.length - 1}
                        reactions={comment.reactions}
                      />
                    ))}
                  </>
                ) : (
                  <>
                    <CommentCardSkeleton showTimeline={true} />
                    <CommentCardSkeleton showTimeline={false} />
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
