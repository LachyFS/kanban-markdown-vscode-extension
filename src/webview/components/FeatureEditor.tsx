import { useEffect, useCallback, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from 'tiptap-markdown'
import { X, Save, Calendar, User, ChevronDown } from 'lucide-react'
import { getTitleFromContent } from '../../shared/types'
import type { FeatureFrontmatter, Priority, FeatureStatus } from '../../shared/types'
import { cn } from '../lib/utils'

interface FeatureEditorProps {
  featureId: string
  content: string
  frontmatter: FeatureFrontmatter
  onSave: (content: string, frontmatter: FeatureFrontmatter) => void
  onClose: () => void
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

export function FeatureEditor({ featureId, content, frontmatter, onSave, onClose }: FeatureEditorProps) {
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

  // Keyboard shortcut for save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave, onClose])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const title = editor ? getTitleFromContent((editor.storage as any).markdown.getMarkdown()) : getTitleFromContent(content)

  return (
    <div className="h-full flex flex-col bg-[var(--vscode-editor-background)] border-l border-zinc-200 dark:border-zinc-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-zinc-500">{featureId}</span>
          <h2 className="font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-[300px]">
            {title || 'Untitled'}
          </h2>
          {isDirty && (
            <span className="text-xs text-orange-500">Unsaved</span>
          )}
        </div>
        <div className="flex items-center gap-2">
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
