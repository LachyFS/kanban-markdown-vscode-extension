import { useState, useEffect, useRef } from 'react'
import { X, Plus, ChevronDown, Calendar, User } from 'lucide-react'
import type { FeatureStatus, Priority } from '../../shared/types'
import { cn } from '../lib/utils'

interface CreateFeatureDialogProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (data: { status: FeatureStatus; priority: Priority; content: string }) => void
  initialStatus?: FeatureStatus
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
        type="button"
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
                type="button"
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

// Wrapper that unmounts and remounts content when dialog opens to reset state
export function CreateFeatureDialog({ isOpen, ...props }: CreateFeatureDialogProps) {
  if (!isOpen) return null
  return <CreateFeatureDialogContent isOpen={isOpen} {...props} />
}

function CreateFeatureDialogContent({
  isOpen,
  onClose,
  onCreate,
  initialStatus = 'backlog'
}: CreateFeatureDialogProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<FeatureStatus>(initialStatus)
  const [priority, setPriority] = useState<Priority>('medium')
  const [assignee, setAssignee] = useState('')
  const [dueDate, setDueDate] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Focus input on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(timer)
  }, [])

  const handleSubmit = () => {
    if (!title.trim()) return

    const content = `# ${title.trim()}${description.trim() ? '\n\n' + description.trim() : ''}`
    onCreate({ status, priority, content })
    onClose()
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && title.trim()) {
        handleSubmit()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  })

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative h-full w-full max-w-lg bg-[var(--vscode-editor-background)] border-l border-zinc-200 dark:border-zinc-700 shadow-xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-zinc-500">NEW</span>
            <h2 className="font-medium text-zinc-900 dark:text-zinc-100">
              Create Feature
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSubmit}
              disabled={!title.trim()}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={14} />
              Create
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
            value={status}
            options={statuses.map(s => ({ value: s, label: statusLabels[s] }))}
            onChange={(v) => setStatus(v as FeatureStatus)}
          />
          <Dropdown
            value={priority}
            options={priorities.map(p => ({ value: p, label: priorityLabels[p] }))}
            onChange={(v) => setPriority(v as Priority)}
          />
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <User size={12} />
            <input
              type="text"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="Assignee"
              className="bg-transparent border-none outline-none w-24 placeholder-zinc-400 text-zinc-600 dark:text-zinc-400"
            />
          </div>
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <Calendar size={12} />
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-transparent border-none outline-none text-zinc-600 dark:text-zinc-400"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          <textarea
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Feature title..."
            className="w-full text-lg font-medium bg-transparent border-none outline-none resize-none text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 mb-4"
            rows={1}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement
              target.style.height = 'auto'
              target.style.height = target.scrollHeight + 'px'
            }}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description..."
            className="w-full text-sm bg-transparent border-none outline-none resize-none text-zinc-600 dark:text-zinc-400 placeholder-zinc-400 min-h-[200px]"
          />
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
          <p className="text-xs text-zinc-500">
            Press <kbd className="px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-700 rounded text-[10px] font-mono">⌘ Enter</kbd> to create
          </p>
        </div>
      </div>
    </div>
  )
}
