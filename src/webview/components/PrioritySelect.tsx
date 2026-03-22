import { ChevronDown } from 'lucide-react'
import type { Priority } from '../../shared/types'
import { t } from '../lib/i18n'

interface PrioritySelectProps {
  value: Priority
  onChange: (priority: Priority) => void
  className?: string
}

function getPriorities(): { value: Priority; label: string; color: string }[] {
  return [
    { value: 'critical', label: t('priority.critical'), color: 'bg-red-500' },
    { value: 'high', label: t('priority.high'), color: 'bg-orange-500' },
    { value: 'medium', label: t('priority.medium'), color: 'bg-yellow-500' },
    { value: 'low', label: t('priority.low'), color: 'bg-green-500' }
  ]
}

export function PrioritySelect({ value, onChange, className = '' }: PrioritySelectProps) {
  const priorities = getPriorities()
  const current = priorities.find((p) => p.value === value) || priorities[2]

  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Priority)}
        className="appearance-none w-full bg-zinc-100 dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded-md px-3 py-2 pr-8 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
      >
        {priorities.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
        <div className={`w-2 h-2 rounded-full ${current.color}`} />
        <ChevronDown size={14} className="text-zinc-400" />
      </div>
    </div>
  )
}
