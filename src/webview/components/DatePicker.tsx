import { useState } from 'react'
import { X, ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { cn } from '../lib/utils'

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

interface DatePickerProps {
  value: string
  onChange: (date: string) => void
  placeholder?: string
}

export function DatePicker({ value, onChange, placeholder = 'Due date' }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const today = new Date()
  const selected = value ? new Date(value + 'T00:00:00') : null
  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? today.getFullYear())
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? today.getMonth())

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  // Monday = 0
  const firstDay = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7
  const cells: (number | null)[] = Array(firstDay).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const selectDay = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, '0')
    const d = String(day).padStart(2, '0')
    onChange(`${viewYear}-${m}-${d}`)
    setIsOpen(false)
  }

  const isToday = (day: number) =>
    day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear()
  const isSelected = (day: number) =>
    selected !== null && day === selected.getDate() && viewMonth === selected.getMonth() && viewYear === selected.getFullYear()

  const formatDisplay = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors"
        style={{
          border: '1px solid var(--vscode-input-border, var(--vscode-panel-border))',
          background: 'var(--vscode-input-background)',
          color: value ? 'var(--vscode-input-foreground)' : 'var(--vscode-input-placeholderForeground)',
        }}
      >
        <Calendar size={12} style={{ color: 'var(--vscode-descriptionForeground)' }} className="shrink-0" />
        <span>{value ? formatDisplay(value) : placeholder}</span>
        {value && (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onChange(''); setIsOpen(false) }}
            className="ml-0.5 hover:text-red-500 transition-colors"
          >
            <X size={12} />
          </span>
        )}
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div
            className="absolute top-full left-0 mt-1 z-20 rounded-lg shadow-lg p-3 w-[252px]"
            style={{
              background: 'var(--vscode-dropdown-background)',
              border: '1px solid var(--vscode-dropdown-border, var(--vscode-panel-border))',
            }}
          >
            {/* Month/year nav */}
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1 rounded transition-colors"
                style={{ color: 'var(--vscode-descriptionForeground)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--vscode-list-hoverBackground)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs font-medium" style={{ color: 'var(--vscode-foreground)' }}>
                {MONTHS[viewMonth]} {viewYear}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                className="p-1 rounded transition-colors"
                style={{ color: 'var(--vscode-descriptionForeground)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--vscode-list-hoverBackground)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <ChevronRight size={14} />
              </button>
            </div>
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAYS.map(d => (
                <div
                  key={d}
                  className="text-center text-[10px] font-medium py-1"
                  style={{ color: 'var(--vscode-descriptionForeground)' }}
                >
                  {d}
                </div>
              ))}
            </div>
            {/* Day grid */}
            <div className="grid grid-cols-7">
              {cells.map((day, i) => (
                <div key={i} className="flex items-center justify-center">
                  {day ? (
                    <button
                      type="button"
                      onClick={() => selectDay(day)}
                      className={cn('w-7 h-7 rounded-md text-[11px] transition-colors font-medium')}
                      style={{
                        background: isSelected(day)
                          ? 'var(--vscode-focusBorder)'
                          : isToday(day)
                            ? 'var(--vscode-editor-selectionBackground)'
                            : undefined,
                        color: isSelected(day)
                          ? 'var(--vscode-editor-background)'
                          : isToday(day)
                            ? 'var(--vscode-foreground)'
                            : 'var(--vscode-foreground)',
                      }}
                      onMouseEnter={e => {
                        if (!isSelected(day)) e.currentTarget.style.background = 'var(--vscode-list-hoverBackground)'
                      }}
                      onMouseLeave={e => {
                        if (!isSelected(day) && !isToday(day)) e.currentTarget.style.background = 'transparent'
                        else if (isToday(day) && !isSelected(day)) e.currentTarget.style.background = 'var(--vscode-editor-selectionBackground)'
                      }}
                    >
                      {day}
                    </button>
                  ) : <div className="w-7 h-7" />}
                </div>
              ))}
            </div>
            {/* Today shortcut */}
            <div
              className="mt-2 pt-2 flex justify-center"
              style={{ borderTop: '1px solid var(--vscode-panel-border)' }}
            >
              <button
                type="button"
                onClick={() => {
                  const m = String(today.getMonth() + 1).padStart(2, '0')
                  const d = String(today.getDate()).padStart(2, '0')
                  onChange(`${today.getFullYear()}-${m}-${d}`)
                  setIsOpen(false)
                }}
                className="text-[11px] font-medium transition-colors"
                style={{ color: 'var(--vscode-textLink-foreground)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--vscode-textLink-activeForeground)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--vscode-textLink-foreground)'}
              >
                Today
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
