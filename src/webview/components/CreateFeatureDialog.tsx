import { useState, useEffect, useRef, useMemo } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from 'tiptap-markdown'
import { X, ChevronDown, User, Tag, Check, CircleDot, Signal, Calendar } from 'lucide-react'
import type { FeatureStatus, Priority } from '../../shared/types'
import { useStore } from '../store'
import { cn } from '../lib/utils'
import { DatePicker } from './DatePicker'

interface MarkdownStorage {
  markdown: { getMarkdown: () => string }
}

function getMarkdown(editor: { storage: unknown }): string {
  return (editor.storage as MarkdownStorage).markdown.getMarkdown()
}

interface CreateFeatureDialogProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (data: { status: FeatureStatus; priority: Priority; content: string; assignee: string | null; dueDate: string | null; labels: string[] }) => void
  initialStatus?: FeatureStatus
}

const priorityConfig: { value: Priority; label: string; dot: string }[] = [
  { value: 'critical', label: 'Critical', dot: 'bg-red-500' },
  { value: 'high', label: 'High', dot: 'bg-orange-500' },
  { value: 'medium', label: 'Medium', dot: 'bg-yellow-500' },
  { value: 'low', label: 'Low', dot: 'bg-green-500' }
]

const statusConfig: { value: FeatureStatus; label: string; dot: string }[] = [
  { value: 'backlog', label: 'Backlog', dot: 'bg-zinc-400' },
  { value: 'todo', label: 'To Do', dot: 'bg-blue-400' },
  { value: 'in-progress', label: 'In Progress', dot: 'bg-amber-400' },
  { value: 'review', label: 'Review', dot: 'bg-purple-400' },
  { value: 'done', label: 'Done', dot: 'bg-emerald-400' }
]

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
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2 py-1 text-xs font-medium rounded transition-colors"
        style={{
          color: 'var(--vscode-foreground)',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--vscode-list-hoverBackground)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
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
                type="button"
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

function AssigneeInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const features = useStore(s => s.features)

  const existingAssignees = useMemo(() => {
    const assignees = new Set<string>()
    features.forEach(f => { if (f.assignee) assignees.add(f.assignee) })
    return Array.from(assignees).sort()
  }, [features])

  const suggestions = useMemo(() => {
    if (!value.trim()) return existingAssignees
    return existingAssignees.filter(a => a.toLowerCase().includes(value.toLowerCase()) && a !== value)
  }, [value, existingAssignees])

  const showSuggestions = isFocused && suggestions.length > 0

  const initials = value.trim()
    ? value.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : null

  return (
    <div ref={containerRef} className="relative flex-1">
      <div
        className="flex items-center gap-2 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {initials && (
          <span
            className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold"
            style={{
              background: 'var(--vscode-badge-background)',
              color: 'var(--vscode-badge-foreground)',
            }}
          >{initials}</span>
        )}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 150)}
          placeholder="No assignee"
          className="flex-1 bg-transparent border-none outline-none text-xs"
          style={{ color: value ? 'var(--vscode-foreground)' : 'var(--vscode-descriptionForeground)' }}
        />
      </div>
      {showSuggestions && (
        <div
          className="absolute top-full left-0 mt-1 z-20 rounded-lg shadow-lg py-1 max-h-[160px] overflow-auto min-w-[180px]"
          style={{
            background: 'var(--vscode-dropdown-background)',
            border: '1px solid var(--vscode-dropdown-border, var(--vscode-panel-border))',
          }}
        >
          {suggestions.map(assignee => (
            <button
              key={assignee}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onChange(assignee) }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors"
              style={{ color: 'var(--vscode-dropdown-foreground)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--vscode-list-hoverBackground)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span
                className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold"
                style={{
                  background: 'var(--vscode-badge-background)',
                  color: 'var(--vscode-badge-foreground)',
                }}
              >{assignee.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)}</span>
              <span>{assignee}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function LabelInput({ labels, onChange }: { labels: string[]; onChange: (labels: string[]) => void }) {
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

  return (
    <div className="relative flex-1">
      <div
        className="flex items-center gap-1.5 flex-wrap cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
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
              onClick={(e) => { e.stopPropagation(); onChange(labels.filter(l => l !== label)) }}
              className="hover:text-red-500 transition-colors"
            >
              <X size={9} />
            </button>
          </span>
        ))}
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
          style={{ color: 'var(--vscode-foreground)' }}
        />
      </div>
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

function PropertyRow({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-[5px] transition-colors"
      onMouseEnter={e => e.currentTarget.style.background = 'var(--vscode-list-hoverBackground)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
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

// Wrapper that unmounts and remounts content when dialog opens to reset state
export function CreateFeatureDialog({ isOpen, ...props }: CreateFeatureDialogProps) {
  if (!isOpen) return null
  return <CreateFeatureDialogContent isOpen={isOpen} {...props} />
}

function CreateFeatureDialogContent({
  isOpen,
  onClose,
  onCreate,
  initialStatus
}: CreateFeatureDialogProps) {
  const { cardSettings } = useStore()
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState<FeatureStatus>(initialStatus ?? cardSettings.defaultStatus)
  const [priority, setPriority] = useState<Priority>(cardSettings.defaultPriority)
  const [assignee, setAssignee] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [labels, setLabels] = useState<string[]>([])
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const descriptionEditor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Add a description...' }),
      Markdown.configure({ html: false, transformPastedText: true })
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[200px]'
      }
    }
  })

  // Focus input on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(timer)
  }, [])

  const handleSubmit = () => {
    if (!title.trim()) return

    const description = descriptionEditor ? getMarkdown(descriptionEditor).trim() : ''
    const content = `# ${title.trim()}${description ? '\n\n' + description : ''}`
    onCreate({ status, priority, content, assignee: assignee.trim() || null, dueDate: dueDate || null, labels })
  }

  // Save and close: creates the feature if there's a title, then closes
  const handleClose = () => {
    handleSubmit()
    onClose()
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && title.trim()) {
        handleClose()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  })

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={handleClose} />
      <div
        className="relative h-full w-1/2 shadow-xl flex flex-col animate-in slide-in-from-right duration-200"
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
            <h2 className="font-medium" style={{ color: 'var(--vscode-foreground)' }}>
              Create Feature
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded transition-colors"
            style={{ color: 'var(--vscode-descriptionForeground)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--vscode-list-hoverBackground)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Metadata */}
        <div
          className="flex flex-col py-0.5"
          style={{
            borderBottom: '1px solid var(--vscode-panel-border)',
          }}
        >
          <PropertyRow label="Status" icon={<CircleDot size={13} />}>
            <Dropdown
              value={status}
              options={statusConfig.map(s => ({ value: s.value, label: s.label, dot: s.dot }))}
              onChange={(v) => setStatus(v as FeatureStatus)}
            />
          </PropertyRow>
          {cardSettings.showPriorityBadges && (
            <PropertyRow label="Priority" icon={<Signal size={13} />}>
              <Dropdown
                value={priority}
                options={priorityConfig.map(p => ({ value: p.value, label: p.label, dot: p.dot }))}
                onChange={(v) => setPriority(v as Priority)}
              />
            </PropertyRow>
          )}
          {cardSettings.showAssignee && (
            <PropertyRow label="Assignee" icon={<User size={13} />}>
              <AssigneeInput value={assignee} onChange={setAssignee} />
            </PropertyRow>
          )}
          {cardSettings.showDueDate && (
            <PropertyRow label="Due date" icon={<Calendar size={13} />}>
              <DatePicker value={dueDate} onChange={setDueDate} />
            </PropertyRow>
          )}
          {cardSettings.showLabels && (
          <PropertyRow label="Labels" icon={<Tag size={13} />}>
            <LabelInput labels={labels} onChange={setLabels} />
          </PropertyRow>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          <textarea
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Feature title..."
            className="w-full text-lg font-medium bg-transparent border-none outline-none resize-none mb-4"
            style={{
              color: 'var(--vscode-foreground)',
            }}
            rows={1}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement
              target.style.height = 'auto'
              target.style.height = target.scrollHeight + 'px'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                descriptionEditor?.commands.focus()
              }
            }}
          />
          <EditorContent editor={descriptionEditor} />
        </div>

        {/* Footer hint */}
        <div
          className="px-4 py-2"
          style={{
            borderTop: '1px solid var(--vscode-panel-border)',
            background: 'var(--vscode-sideBar-background, var(--vscode-editor-background))',
          }}
        >
          <p className="text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>
            Auto-saves on close ·{' '}
            <kbd
              className="px-1.5 py-0.5 rounded text-[10px] font-mono"
              style={{ background: 'var(--vscode-keybindingLabel-background, var(--vscode-badge-background))', color: 'var(--vscode-keybindingLabel-foreground, var(--vscode-foreground))', border: '1px solid var(--vscode-keybindingLabel-border, var(--vscode-panel-border))' }}
            >Esc</kbd>{' '}
            <kbd
              className="px-1.5 py-0.5 rounded text-[10px] font-mono"
              style={{ background: 'var(--vscode-keybindingLabel-background, var(--vscode-badge-background))', color: 'var(--vscode-keybindingLabel-foreground, var(--vscode-foreground))', border: '1px solid var(--vscode-keybindingLabel-border, var(--vscode-panel-border))' }}
            >⌘S</kbd>{' '}
            <kbd
              className="px-1.5 py-0.5 rounded text-[10px] font-mono"
              style={{ background: 'var(--vscode-keybindingLabel-background, var(--vscode-badge-background))', color: 'var(--vscode-keybindingLabel-foreground, var(--vscode-foreground))', border: '1px solid var(--vscode-keybindingLabel-border, var(--vscode-panel-border))' }}
            >⌘ Enter</kbd>{' '}to save &amp; close
          </p>
        </div>
      </div>
    </div>
  )
}
