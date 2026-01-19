import { Plus } from 'lucide-react'
import { FeatureCard } from './FeatureCard'
import { QuickAddInput } from './QuickAddInput'
import type { Feature, FeatureStatus, Priority, KanbanColumn as KanbanColumnType } from '../../shared/types'
import type { LayoutMode } from '../store'

interface KanbanColumnProps {
  column: KanbanColumnType
  features: Feature[]
  onFeatureClick: (feature: Feature) => void
  onAddFeature: (status: string) => void
  onQuickAdd: (data: { status: FeatureStatus; priority: Priority; content: string }) => void
  onDragStart: (e: React.DragEvent, feature: Feature) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent, status: string) => void
  layout: LayoutMode
}

export function KanbanColumn({
  column,
  features,
  onFeatureClick,
  onAddFeature,
  onQuickAdd,
  onDragStart,
  onDragOver,
  onDrop,
  layout
}: KanbanColumnProps) {
  const isVertical = layout === 'vertical'

  return (
    <div
      className={
        isVertical
          ? "flex flex-col bg-zinc-100 dark:bg-zinc-800/50 rounded-lg"
          : "flex-shrink-0 w-72 h-full flex flex-col bg-zinc-100 dark:bg-zinc-800/50 rounded-lg"
      }
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, column.id)}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: column.color }} />
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{column.name}</h3>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded-full">
            {features.length}
          </span>
        </div>
        <button
          onClick={() => onAddFeature(column.id)}
          className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          title={`Add to ${column.name}`}
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Quick Add */}
      <div className="px-2 py-1.5 border-b border-zinc-200 dark:border-zinc-700">
        <QuickAddInput status={column.id as FeatureStatus} onAdd={onQuickAdd} />
      </div>

      {/* Column Content */}
      <div
        className={
          isVertical
            ? "flex-1 p-2 flex flex-wrap gap-2"
            : "flex-1 overflow-y-auto p-2 space-y-2 min-h-[200px]"
        }
      >
        {features.map((feature) => (
          <div
            key={feature.id}
            draggable
            onDragStart={(e) => onDragStart(e, feature)}
            className={isVertical ? "w-64" : ""}
          >
            <FeatureCard feature={feature} onClick={() => onFeatureClick(feature)} />
          </div>
        ))}

        {features.length === 0 && (
          <div className={isVertical ? "text-sm text-zinc-400 dark:text-zinc-500 py-4" : "text-center py-8 text-sm text-zinc-400 dark:text-zinc-500"}>
            No features
          </div>
        )}
      </div>
    </div>
  )
}
