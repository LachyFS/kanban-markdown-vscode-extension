import { useState, useRef, useEffect } from 'react'
import { X, Pencil, Check, Tag, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { vscode } from '../vscodeApi'

interface LabelManagerProps {
  onClose: () => void
}

export function LabelManager({ onClose }: Readonly<LabelManagerProps>) {
  const { getUniqueLabels, features, labelFilter, setLabelFilter } = useStore()
  const labels = getUniqueLabels()

  const [editingLabel, setEditingLabel] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Focus input when editing starts
  useEffect(() => {
    if (editingLabel && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingLabel])

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // Delay to avoid the opening click from closing immediately
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingLabel) {
          setEditingLabel(null)
        } else {
          onClose()
        }
      }
    }
    globalThis.addEventListener('keydown', handleKeyDown)
    return () => globalThis.removeEventListener('keydown', handleKeyDown)
  }, [editingLabel, onClose])

  const getLabelCount = (label: string): number => {
    return features.filter(f => f.labels.includes(label)).length
  }

  const handleStartEdit = (label: string) => {
    setEditingLabel(label)
    setEditValue(label)
  }

  const handleConfirmRename = () => {
    if (editingLabel && editValue.trim() && editValue.trim() !== editingLabel) {
      const newName = editValue.trim()
      vscode.postMessage({ type: 'renameLabel', oldName: editingLabel, newName })
      // If the filter was set to the old label, update it
      if (labelFilter === editingLabel) {
        setLabelFilter(newName)
      }
    }
    setEditingLabel(null)
  }

  const handleDelete = (label: string) => {
    vscode.postMessage({ type: 'deleteLabel', labelName: label })
    // If filtering by the deleted label, reset to show all
    if (labelFilter === label) {
      setLabelFilter('all')
    }
  }

  const handleCancelEdit = () => {
    setEditingLabel(null)
  }

  useEffect(() => {
    if (labels.length === 0) onClose()
  }, [labels.length, onClose])

  if (labels.length === 0) {
    return null
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" />

      {/* Panel */}
      <div
        ref={panelRef}
        className="absolute top-full right-0 mt-1 z-50 rounded-lg shadow-lg min-w-[260px] max-w-[340px] bg-white dark:bg-zinc-800"
        style={{
          border: '1px solid var(--vscode-dropdown-border, var(--vscode-panel-border))',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-2"
          style={{ borderBottom: '1px solid var(--vscode-panel-border)' }}
        >
          <div className="flex items-center gap-1.5">
            <Tag size={14} style={{ color: 'var(--vscode-descriptionForeground)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--vscode-foreground)' }}>
              Manage Labels
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-0.5 rounded transition-colors"
            style={{ color: 'var(--vscode-descriptionForeground)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--vscode-foreground)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--vscode-descriptionForeground)'}
          >
            <X size={14} />
          </button>
        </div>

        {/* Label list */}
        <div className="py-1 max-h-[300px] overflow-y-auto">
          {labels.map((label) => (
            <div
              key={label}
              className="flex items-center gap-2 px-3 py-1.5 group"
            >
              {editingLabel === label ? (
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <input
                    ref={inputRef}
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleConfirmRename()
                      if (e.key === 'Escape') handleCancelEdit()
                    }}
                    className="flex-1 min-w-0 text-sm rounded px-1.5 py-0.5 focus:outline-none"
                    style={{
                      background: 'var(--vscode-input-background)',
                      color: 'var(--vscode-input-foreground)',
                      border: '1px solid var(--vscode-focusBorder)',
                    }}
                  />
                  <button
                    onClick={handleConfirmRename}
                    className="p-1 rounded transition-colors shrink-0"
                    title="Confirm rename"
                    style={{ color: 'var(--vscode-testing-iconPassed, #22c55e)' }}
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="p-1 rounded transition-colors shrink-0"
                    title="Cancel"
                    style={{ color: 'var(--vscode-descriptionForeground)' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <span
                    className="flex-1 min-w-0 text-sm truncate"
                    style={{ color: 'var(--vscode-foreground)' }}
                  >
                    {label}
                  </span>
                  {(() => {
                    const count = getLabelCount(label)
                    return (
                      <span
                        className="text-xs shrink-0"
                        style={{ color: 'var(--vscode-descriptionForeground)' }}
                        title={`Used on ${count} card${count === 1 ? '' : 's'}`}
                      >
                        {count}
                      </span>
                    )
                  })()}
                  <button
                    onClick={() => handleStartEdit(label)}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    title="Rename label"
                    style={{ color: 'var(--vscode-descriptionForeground)' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--vscode-foreground)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--vscode-descriptionForeground)'}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => handleDelete(label)}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    title="Delete label"
                    style={{ color: 'var(--vscode-descriptionForeground)' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--vscode-errorForeground)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--vscode-descriptionForeground)'}
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
