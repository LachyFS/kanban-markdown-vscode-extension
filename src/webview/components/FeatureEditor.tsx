import { useEffect, useCallback, useState, useRef, useMemo } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from 'tiptap-markdown'
import { X, User, ChevronDown, Wand2, Tag, Plus, Check, CircleDot, Signal, Calendar, Trash2 } from 'lucide-react'
import type { FeatureFrontmatter, Priority, FeatureStatus } from '../../shared/types'
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

interface FeatureEditorProps {
  featureId: string
  content: string
  frontmatter: FeatureFrontmatter
  onSave: (content: string, frontmatter: FeatureFrontmatter) => void
  onClose: () => void
  onDelete: () => void
  onStartWithAI: (agent: AIAgent, permissionMode: PermissionMode) => void
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
        onClick={() => inputRef.current?.focus()}
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

export function FeatureEditor({ featureId, content, frontmatter, onSave, onClose, onDelete, onStartWithAI }: FeatureEditorProps) {
  const { cardSettings } = useStore()
  const [currentFrontmatter, setCurrentFrontmatter] = useState(frontmatter)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
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
  }, [editor, featureId])

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
          <span className="text-xs font-mono" style={{ color: 'var(--vscode-descriptionForeground)' }}>{featureId}</span>
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
            <button
              onClick={() => setConfirmingDelete(true)}
              className="p-1.5 rounded transition-colors vscode-hover-bg"
              style={{ color: 'var(--vscode-descriptionForeground)' }}
              title="Delete ticket"
            >
              <Trash2 size={16} />
            </button>
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

      {/* Editor */}
      <div className="flex-1 overflow-auto">
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  )
}
