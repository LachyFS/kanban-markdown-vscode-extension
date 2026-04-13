import { useState, useRef, useMemo } from 'react'
import { useStore } from '../store'
import { t } from '../lib/i18n'
import { epicThemeFromName } from '../../shared/epicColor'

export function EpicInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const features = useStore(s => s.features)
  const isDarkMode = useStore(s => s.isDarkMode)

  const existingEpics = useMemo(() => {
    const epics = new Set<string>()
    features.forEach(f => {
      const e = f.epic?.trim()
      if (e) epics.add(e)
    })
    return Array.from(epics).sort()
  }, [features])

  const suggestions = useMemo(() => {
    if (!value.trim()) return existingEpics
    return existingEpics.filter(
      e => e.toLowerCase().includes(value.toLowerCase()) && e !== value.trim()
    )
  }, [value, existingEpics])

  const showSuggestions = isFocused && suggestions.length > 0

  const trimmed = value.trim()
  const inputColor = trimmed
    ? epicThemeFromName(trimmed, isDarkMode).foreground
    : undefined

  return (
    <div className="relative flex-1 min-w-0">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setTimeout(() => setIsFocused(false), 150)}
        placeholder={t('editor.noEpic')}
        className="w-full bg-transparent border-none outline-none text-xs"
        style={{
          color: trimmed ? inputColor : 'var(--vscode-descriptionForeground)'
        }}
      />
      {showSuggestions && (
        <div
          className="absolute top-full left-0 mt-1 z-20 rounded-lg shadow-lg py-1 max-h-[160px] overflow-auto min-w-[180px]"
          style={{
            background: 'var(--vscode-dropdown-background)',
            border: '1px solid var(--vscode-dropdown-border, var(--vscode-panel-border))',
          }}
        >
          {suggestions.map(epic => {
            const suggestionColor = epicThemeFromName(epic, isDarkMode).foreground
            return (
              <button
                key={epic}
                type="button"
                onMouseDown={e => {
                  e.preventDefault()
                  onChange(epic)
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors text-left"
                style={{ color: 'var(--vscode-dropdown-foreground)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--vscode-list-hoverBackground)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span
                  className="inline-block px-1.5 py-0.5 text-[10px] font-medium rounded"
                  style={{
                    background: 'var(--vscode-badge-background)',
                    color: suggestionColor,
                  }}
                >
                  {epic}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
