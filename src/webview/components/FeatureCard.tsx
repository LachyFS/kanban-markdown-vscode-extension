import { Calendar, User } from 'lucide-react'
import { getTitleFromContent } from '../../shared/types'
import type { Feature, Priority } from '../../shared/types'

interface FeatureCardProps {
  feature: Feature
  onClick: () => void
  isDragging?: boolean
}

const priorityColors: Record<Priority, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
}

const priorityLabels: Record<Priority, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Med',
  low: 'Low'
}

export function FeatureCard({ feature, onClick, isDragging }: FeatureCardProps) {
  const title = getTitleFromContent(feature.content)

  const formatDueDate = (dateStr: string | null) => {
    if (!dateStr) return null
    const date = new Date(dateStr)
    const now = new Date()
    const diff = date.getTime() - now.getTime()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))

    if (days < 0) return { text: 'Overdue', className: 'text-red-500' }
    if (days === 0) return { text: 'Today', className: 'text-orange-500' }
    if (days === 1) return { text: 'Tomorrow', className: 'text-yellow-600 dark:text-yellow-400' }
    if (days <= 7) return { text: `${days}d`, className: 'text-zinc-500 dark:text-zinc-400' }

    return {
      text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      className: 'text-zinc-500 dark:text-zinc-400'
    }
  }

  const dueInfo = formatDueDate(feature.dueDate)

  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 cursor-pointer hover:shadow-md transition-shadow ${
        isDragging ? 'shadow-lg opacity-90' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500">{feature.id}</span>
        <span
          className={`text-xs font-medium px-1.5 py-0.5 rounded ${priorityColors[feature.priority]}`}
        >
          {priorityLabels[feature.priority]}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2 line-clamp-2">
        {title}
      </h3>

      {/* Labels */}
      {feature.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {feature.labels.slice(0, 3).map((label) => (
            <span
              key={label}
              className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
            >
              {label}
            </span>
          ))}
          {feature.labels.length > 3 && (
            <span className="text-xs text-zinc-400">+{feature.labels.length - 3}</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1">
          {feature.assignee && feature.assignee !== 'null' && (
            <div className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
              <User size={12} />
              <span>@{feature.assignee}</span>
            </div>
          )}
        </div>
        {dueInfo && (
          <div className={`flex items-center gap-1 ${dueInfo.className}`}>
            <Calendar size={12} />
            <span>{dueInfo.text}</span>
          </div>
        )}
      </div>
    </div>
  )
}
