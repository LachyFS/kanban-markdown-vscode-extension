import { useState, useRef, useMemo } from 'react'
import { useStore } from '../store'
import { t } from '../lib/i18n'

/** Assignee field with suggestions from assignees on other tickets (derived from store `features`). */
export function AssigneeInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const features = useStore(s => s.features)

  const existingAssignees = useMemo(() => {
    const assignees = new Set<string>()
    features.forEach(f => {
      if (f.assignee) assignees.add(f.assignee)
    })
    return Array.from(assignees).sort()
  }, [features])

  const suggestions = useMemo(() => {
    if (!value.trim()) return existingAssignees
    return existingAssignees.filter(
      a => a.toLowerCase().includes(value.toLowerCase()) && a !== value
    )
  }, [value, existingAssignees])

  const showSuggestions = isFocused && suggestions.length > 0

  const initials = value.trim()
    ? value
        .trim()
        .split(/\s+/)
        .map(w => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : null

  return (
    <div className="relative flex-1 min-w-0">
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
          >
            {initials}
          </span>
        )}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 150)}
          placeholder={t('editor.noAssignee')}
          className="flex-1 min-w-0 bg-transparent border-none outline-none text-xs"
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
              onMouseDown={e => {
                e.preventDefault()
                onChange(assignee)
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors"
              style={{ color: 'var(--vscode-dropdown-foreground)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--vscode-list-hoverBackground)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span
                className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold"
                style={{
                  background: 'var(--vscode-badge-background)',
                  color: 'var(--vscode-badge-foreground)',
                }}
              >
                {assignee
                  .split(/\s+/)
                  .map(w => w[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)}
              </span>
              <span>{assignee}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
