import { Calendar, X } from 'lucide-react'
import { getTitleFromContent } from '../../shared/types'
import type { Feature, Priority } from '../../shared/types'
import { useStore } from '../store'

interface FeatureCardProps {
  feature: Feature
  onClick: () => void
  onDelete: (featureId: string) => void
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

function getDescriptionFromContent(content: string): string {
  // Remove the first # heading line, then grab the first non-empty text
  const lines = content.split('\n')
  const headingIndex = lines.findIndex(l => /^#\s+/.test(l))
  const afterHeading = headingIndex >= 0 ? lines.slice(headingIndex + 1) : lines
  const desc = afterHeading
    .map(l => l.replace(/^#{1,6}\s+/, '').trim())
    .filter(l => l.length > 0)
    .join(' ')
  return desc
}

export function FeatureCard({ feature, onClick, onDelete, isDragging }: FeatureCardProps) {
  const { cardSettings } = useStore()
  const title = getTitleFromContent(feature.content)
  const description = getDescriptionFromContent(feature.content)

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
      className={`group relative bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 ${cardSettings.compactMode ? 'p-2' : 'p-3'} cursor-pointer hover:shadow-md transition-shadow ${
        isDragging ? 'shadow-lg opacity-90' : ''
      }`}
    >
      {/* Delete button */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(feature.id) }}
        className="absolute top-1.5 right-1.5 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-opacity"
        title="Delete"
      >
        <X size={14} />
      </button>

      {/* Header */}
      {cardSettings.showPriorityBadges && (
        <div className={`flex items-start justify-end pr-4 ${cardSettings.compactMode ? 'mb-1' : 'mb-2'}`}>
          <span
            className={`text-xs font-medium px-1.5 py-0.5 rounded ${priorityColors[feature.priority]}`}
          >
            {priorityLabels[feature.priority]}
          </span>
        </div>
      )}

      {/* Title */}
      <h3 className={`text-sm font-medium text-zinc-900 dark:text-zinc-100 ${description ? 'mb-1' : cardSettings.compactMode ? 'mb-1' : 'mb-2'} line-clamp-2`}>
        {title}
      </h3>

      {/* Description */}
      {description && !cardSettings.compactMode && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mb-2">
          {description}
        </p>
      )}

      {/* Labels */}
      {cardSettings.showLabels && !cardSettings.compactMode && feature.labels.length > 0 && (
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
          {cardSettings.showAssignee && feature.assignee && feature.assignee !== 'null' && (
            <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
              <span className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold bg-zinc-200 dark:bg-zinc-600 text-zinc-700 dark:text-zinc-300">
                {feature.assignee.split(/\s+/).map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
              </span>
              <span>{feature.assignee}</span>
            </div>
          )}
        </div>
        {cardSettings.showDueDate && dueInfo && (
          <div className={`flex items-center gap-1 ${dueInfo.className}`}>
            <Calendar size={12} />
            <span>{dueInfo.text}</span>
          </div>
        )}
      </div>
    </div>
  )
}
