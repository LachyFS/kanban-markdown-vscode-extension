import { useState, useEffect, useRef } from 'react'
import { X, ChevronDown, User, Tag, Plus, Check } from 'lucide-react'
import type { FeatureStatus, Priority } from '../../shared/types'
import { useStore } from '../store'
import { cn } from '../lib/utils'
import { DatePicker } from './DatePicker'

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
        className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors"
        style={{
          border: '1px solid var(--vscode-input-border, var(--vscode-panel-border))',
          background: 'var(--vscode-input-background)',
          color: 'var(--vscode-input-foreground)',
        }}
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

function LabelInput({ labels, onChange }: { labels: string[]; onChange: (labels: string[]) => void }) {
  const [newLabel, setNewLabel] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const addLabel = () => {
    const label = newLabel.trim()
    if (label && !labels.includes(label)) {
      onChange([...labels, label])
    }
    setNewLabel('')
  }

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-md flex-wrap flex-1 min-w-[140px] cursor-text transition-colors"
      style={{
        border: '1px solid var(--vscode-input-border, var(--vscode-panel-border))',
        background: 'var(--vscode-input-background)',
      }}
      onClick={() => inputRef.current?.focus()}
    >
      <Tag size={14} style={{ color: 'var(--vscode-descriptionForeground)' }} className="shrink-0" />
      {labels.map(label => (
        <span
          key={label}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full"
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
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={newLabel}
        onChange={(e) => setNewLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); addLabel() }
          if (e.key === 'Backspace' && !newLabel && labels.length > 0) {
            onChange(labels.slice(0, -1))
          }
          if (e.key === 'Escape') { setNewLabel(''); inputRef.current?.blur() }
        }}
        placeholder={labels.length === 0 ? 'Add labels...' : ''}
        className="flex-1 min-w-[60px] bg-transparent border-none outline-none text-xs"
        style={{
          color: 'var(--vscode-input-foreground)',
        }}
      />
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
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<FeatureStatus>(initialStatus ?? cardSettings.defaultStatus)
  const [priority, setPriority] = useState<Priority>(cardSettings.defaultPriority)
  const [assignee, setAssignee] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [labels, setLabels] = useState<string[]>([])
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const descriptionRef = useRef<HTMLTextAreaElement>(null)

  // Focus input on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(timer)
  }, [])

  const handleSubmit = () => {
    if (!title.trim()) return

    const content = `# ${title.trim()}${description.trim() ? '\n\n' + description.trim() : ''}`
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
        className="relative h-full w-full max-w-lg shadow-xl flex flex-col animate-in slide-in-from-right duration-200"
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
            <span className="text-xs font-mono" style={{ color: 'var(--vscode-descriptionForeground)' }}>NEW</span>
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
          className="flex flex-col gap-2 px-4 py-3"
          style={{
            borderBottom: '1px solid var(--vscode-panel-border)',
            background: 'var(--vscode-sideBar-background, var(--vscode-editor-background))',
          }}
        >
          <div className="flex items-center gap-2">
            <Dropdown
              value={status}
              options={statusConfig.map(s => ({ value: s.value, label: s.label, dot: s.dot }))}
              onChange={(v) => setStatus(v as FeatureStatus)}
            />
            {cardSettings.showPriorityBadges && (
              <Dropdown
                value={priority}
                options={priorityConfig.map(p => ({ value: p.value, label: p.label, dot: p.dot }))}
                onChange={(v) => setPriority(v as Priority)}
              />
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {cardSettings.showAssignee && (
              <div
                className="flex items-center gap-2 px-3 py-2 text-xs rounded-md transition-colors"
                style={{
                  border: '1px solid var(--vscode-input-border, var(--vscode-panel-border))',
                  background: 'var(--vscode-input-background)',
                }}
              >
                <User size={14} className="shrink-0" style={{ color: 'var(--vscode-descriptionForeground)' }} />
                <input
                  type="text"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  placeholder="Assignee"
                  className="bg-transparent border-none outline-none w-28 text-xs"
                  style={{
                    color: 'var(--vscode-input-foreground)',
                  }}
                />
              </div>
            )}
            {cardSettings.showDueDate && (
              <DatePicker value={dueDate} onChange={setDueDate} />
            )}
            <LabelInput labels={labels} onChange={setLabels} />
          </div>
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
                descriptionRef.current?.focus()
              }
            }}
          />
          <textarea
            ref={descriptionRef}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description..."
            className="w-full text-sm bg-transparent border-none outline-none resize-none min-h-[200px]"
            style={{
              color: 'var(--vscode-descriptionForeground)',
            }}
          />
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
            >Esc</kbd>{' '}or{' '}
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
