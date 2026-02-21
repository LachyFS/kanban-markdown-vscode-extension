import type { KanbanColumn as KanbanColumnType } from '../../shared/types'
import type { LayoutMode } from '../store'

interface CollapsedColumnProps {
  column: KanbanColumnType
  featureCount: number
  onExpand: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent, status: string) => void
  layout: LayoutMode
}

export function CollapsedColumn({
  column,
  featureCount,
  onExpand,
  onDragOver,
  onDrop,
  layout
}: CollapsedColumnProps) {
  const isVertical = layout === 'vertical'

  if (isVertical) {
    return (
      <button
        onClick={onExpand}
        onDragOver={onDragOver}
        onDrop={(e) => onDrop(e, column.id)}
        className="flex items-center gap-2 px-3 py-2 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700/60 transition-colors cursor-pointer"
      >
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: column.color }} />
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{column.name}</span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded-full">
          {featureCount}
        </span>
      </button>
    )
  }

  return (
    <button
      onClick={onExpand}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, column.id)}
      className="flex-shrink-0 w-10 h-full flex flex-col items-center bg-zinc-100 dark:bg-zinc-800/50 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700/60 transition-colors cursor-pointer py-3 gap-3"
    >
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: column.color }} />
      <span className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded-full">
        {featureCount}
      </span>
      <span
        className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
        style={{ writingMode: 'vertical-rl' }}
      >
        {column.name}
      </span>
    </button>
  )
}
