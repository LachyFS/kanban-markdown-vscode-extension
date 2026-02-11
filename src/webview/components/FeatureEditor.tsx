import { useEffect, useCallback, useState, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from 'tiptap-markdown'
import { X, Calendar, User, ChevronDown, Wand2, Tag, Plus } from 'lucide-react'
import type { FeatureFrontmatter, Priority, FeatureStatus } from '../../shared/types'
import { cn } from '../lib/utils'
import { useStore } from '../store'

type AIAgent = 'claude' | 'codex' | 'opencode'
type PermissionMode = 'default' | 'plan' | 'acceptEdits' | 'bypassPermissions'

interface FeatureEditorProps {
  featureId: string
  content: string
  frontmatter: FeatureFrontmatter
  onSave: (content: string, frontmatter: FeatureFrontmatter) => void
  onClose: () => void
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
  options: { value: string; label: string }[]
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
        className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
      >
        <span>{current?.label}</span>
        <ChevronDown size={12} />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg py-1 min-w-[120px]">
            {options.map(option => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                }}
                className={cn(
                  'w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-700',
                  option.value === value && 'bg-zinc-100 dark:bg-zinc-700'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
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
  const [isAdding, setIsAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isAdding && inputRef.current) inputRef.current.focus()
  }, [isAdding])

  const addLabel = () => {
    const label = newLabel.trim()
    if (label && !labels.includes(label)) {
      onChange([...labels, label])
    }
    setNewLabel('')
    setIsAdding(false)
  }

  const removeLabel = (label: string) => {
    onChange(labels.filter(l => l !== label))
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Tag size={12} className="text-zinc-400 shrink-0" />
      {labels.map(label => (
        <span
          key={label}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-zinc-200 dark:bg-zinc-600 text-zinc-700 dark:text-zinc-300 rounded"
        >
          {label}
          <button
            onClick={() => removeLabel(label)}
            className="hover:text-red-500 transition-colors"
          >
            <X size={10} />
          </button>
        </span>
      ))}
      {isAdding ? (
        <input
          ref={inputRef}
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onBlur={addLabel}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addLabel()
            if (e.key === 'Escape') { setNewLabel(''); setIsAdding(false) }
          }}
          placeholder="Label..."
          className="w-16 px-1 py-0.5 text-[10px] bg-transparent border border-zinc-300 dark:border-zinc-600 rounded outline-none focus:border-blue-500 text-zinc-700 dark:text-zinc-300 placeholder-zinc-400"
        />
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="inline-flex items-center gap-0.5 px-1 py-0.5 text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded transition-colors"
        >
          <Plus size={10} />
        </button>
      )}
    </div>
  )
}

export function FeatureEditor({ featureId, content, frontmatter, onSave, onClose, onStartWithAI }: FeatureEditorProps) {
  const { cardSettings } = useStore()
  const [currentFrontmatter, setCurrentFrontmatter] = useState(frontmatter)
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const markdown = (ed.storage as any).markdown.getMarkdown()
        onSave(markdown, currentFrontmatterRef.current)
      }, 800)
    }
  })

  const save = useCallback(() => {
    if (!editor) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const markdown = (editor.storage as any).markdown.getMarkdown()
    onSave(markdown, currentFrontmatter)
  }, [editor, currentFrontmatter, onSave])

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // Set content when editor is ready
  useEffect(() => {
    if (editor && content) {
      isInitialLoad.current = true
      editor.commands.setContent(content)
      // Allow a tick for the onUpdate from setContent to fire, then re-enable
      requestAnimationFrame(() => { isInitialLoad.current = false })
    }
  }, [editor, content])

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const markdown = (editor.storage as any).markdown.getMarkdown()
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
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
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
  }, [save, onClose, onStartWithAI])

  return (
    <div className="h-full flex flex-col bg-[var(--vscode-editor-background)] border-l border-zinc-200 dark:border-zinc-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-zinc-500">{featureId}</span>
        </div>
        <div className="flex items-center gap-2">
          <AIDropdown onSelect={onStartWithAI} />
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Metadata bar */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 flex-wrap">
        <Dropdown
          value={currentFrontmatter.status}
          options={statuses.map(s => ({ value: s, label: statusLabels[s] }))}
          onChange={(v) => handleFrontmatterUpdate({ status: v as FeatureStatus })}
        />
        {cardSettings.showPriorityBadges && (
          <Dropdown
            value={currentFrontmatter.priority}
            options={priorities.map(p => ({ value: p, label: priorityLabels[p] }))}
            onChange={(v) => handleFrontmatterUpdate({ priority: v as Priority })}
          />
        )}
        {cardSettings.showAssignee && (
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <User size={12} />
            <input
              type="text"
              value={currentFrontmatter.assignee || ''}
              onChange={(e) => handleFrontmatterUpdate({ assignee: e.target.value || null })}
              placeholder="Assignee"
              className="bg-transparent border-none outline-none w-24 placeholder-zinc-400"
            />
          </div>
        )}
        {cardSettings.showDueDate && (
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <Calendar size={12} />
            <input
              type="date"
              value={currentFrontmatter.dueDate || ''}
              onChange={(e) => handleFrontmatterUpdate({ dueDate: e.target.value || null })}
              className="bg-transparent border-none outline-none text-zinc-600 dark:text-zinc-400"
            />
          </div>
        )}
        <LabelEditor
          labels={currentFrontmatter.labels}
          onChange={(labels) => handleFrontmatterUpdate({ labels })}
        />
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-auto">
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  )
}
