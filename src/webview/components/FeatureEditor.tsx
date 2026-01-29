import { useEffect, useCallback, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from 'tiptap-markdown'
import { X, Save, Calendar, User, ChevronDown, Wand2 } from 'lucide-react'
import type { FeatureFrontmatter, Priority, FeatureStatus } from '../../shared/types'
import { cn } from '../lib/utils'

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
    bg: 'bg-gradient-to-b from-amber-600 to-amber-800',
    hover: 'hover:from-amber-700 hover:to-amber-900',
    shadow: 'shadow-[0_2px_8px_-2px_rgba(180,83,9,0.5),inset_0_1px_0_rgba(255,255,255,0.15)]',
    border: 'border border-amber-900/50'
  },
  codex: {
    bg: 'bg-gradient-to-b from-emerald-400 to-emerald-600',
    hover: 'hover:from-emerald-500 hover:to-emerald-700',
    shadow: 'shadow-[0_2px_8px_-2px_rgba(16,185,129,0.5),inset_0_1px_0_rgba(255,255,255,0.2)]',
    border: 'border border-emerald-700/50'
  },
  opencode: {
    bg: 'bg-gradient-to-b from-slate-400 to-slate-600',
    hover: 'hover:from-slate-500 hover:to-slate-700',
    shadow: 'shadow-[0_2px_8px_-2px_rgba(100,116,139,0.5),inset_0_1px_0_rgba(255,255,255,0.15)]',
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
          'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-md transition-all',
          buttonColors.bg,
          buttonColors.hover,
          buttonColors.shadow,
          buttonColors.border,
          'active:scale-[0.98] active:shadow-none'
        )}
      >
        <Wand2 size={14} />
        Build with AI
        <span className="ml-1 text-[10px] opacity-70">⌘B</span>
        <ChevronDown size={12} className={cn('transition-transform', isOpen && 'rotate-180')} />
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

export function FeatureEditor({ featureId, content, frontmatter, onSave, onClose, onStartWithAI }: FeatureEditorProps) {
  const [currentFrontmatter, setCurrentFrontmatter] = useState(frontmatter)
  const [isDirty, setIsDirty] = useState(false)

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
    onUpdate: () => setIsDirty(true)
  })

  // Set content when editor is ready
  useEffect(() => {
    if (editor && content) {
      editor.commands.setContent(content)
      setIsDirty(false)
    }
  }, [editor, content])

  // Reset frontmatter when prop changes
  useEffect(() => {
    setCurrentFrontmatter(frontmatter)
  }, [frontmatter])

  const handleSave = useCallback(() => {
    if (!editor) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const markdown = (editor.storage as any).markdown.getMarkdown()
    onSave(markdown, currentFrontmatter)
    setIsDirty(false)
  }, [editor, currentFrontmatter, onSave])

  const handleFrontmatterUpdate = useCallback((updates: Partial<FeatureFrontmatter>) => {
    setCurrentFrontmatter(prev => ({ ...prev, ...updates }))
    setIsDirty(true)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        onStartWithAI('claude', 'default')
      }
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave, onClose, onStartWithAI])

  return (
    <div className="h-full flex flex-col bg-[var(--vscode-editor-background)] border-l border-zinc-200 dark:border-zinc-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-zinc-500">{featureId}</span>
          {isDirty && (
            <span className="text-xs text-orange-500">Unsaved</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <AIDropdown onSelect={onStartWithAI} />
          <button
            onClick={handleSave}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
          >
            <Save size={14} />
            Save
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Metadata bar */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
        <Dropdown
          value={currentFrontmatter.status}
          options={statuses.map(s => ({ value: s, label: statusLabels[s] }))}
          onChange={(v) => handleFrontmatterUpdate({ status: v as FeatureStatus })}
        />
        <Dropdown
          value={currentFrontmatter.priority}
          options={priorities.map(p => ({ value: p, label: priorityLabels[p] }))}
          onChange={(v) => handleFrontmatterUpdate({ priority: v as Priority })}
        />
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
        <div className="flex items-center gap-1 text-xs text-zinc-500">
          <Calendar size={12} />
          <input
            type="date"
            value={currentFrontmatter.dueDate || ''}
            onChange={(e) => handleFrontmatterUpdate({ dueDate: e.target.value || null })}
            className="bg-transparent border-none outline-none text-zinc-600 dark:text-zinc-400"
          />
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-auto">
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  )
}
