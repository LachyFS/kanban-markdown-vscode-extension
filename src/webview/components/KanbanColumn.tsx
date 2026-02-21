import { Plus, ChevronLeft } from 'lucide-react'
import { FeatureCard } from './FeatureCard'
import type { Feature, KanbanColumn as KanbanColumnType } from '../../shared/types'
import type { LayoutMode } from '../store'
import type { DropTarget } from './KanbanBoard'

interface KanbanColumnProps {
  column: KanbanColumnType
  features: Feature[]
  onFeatureClick: (feature: Feature) => void
  onAddFeature: (status: string) => void
  onCollapse: () => void
  onDragStart: (e: React.DragEvent, feature: Feature) => void
  onDragOver: (e: React.DragEvent) => void
  onDragOverCard: (e: React.DragEvent, columnId: string, cardIndex: number) => void
  onDrop: (e: React.DragEvent, status: string) => void
  onDragEnd: () => void
  draggedFeature: Feature | null
  dropTarget: DropTarget | null
  layout: LayoutMode
}

export function KanbanColumn({
  column,
  features,
  onFeatureClick,
  onAddFeature,
  onCollapse,
  onDragStart,
  onDragOver,
  onDragOverCard,
  onDrop,
  onDragEnd,
  draggedFeature,
  dropTarget,
  layout
}: KanbanColumnProps) {
  const isVertical = layout === 'vertical'
  const isDropTarget = dropTarget && dropTarget.columnId === column.id

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
      <div className="flex items-center justify-between w-full px-3 py-2 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: column.color }} />
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{column.name}</h3>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded-full">
            {features.length}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={onCollapse}
            className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            title={`Collapse ${column.name}`}
          >
            <ChevronLeft size={16} className="text-zinc-500" />
          </button>
          <button
            onClick={() => onAddFeature(column.id)}
            className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            title={`Add to ${column.name}`}
          >
            <Plus size={16} className="text-zinc-500" />
          </button>
        </div>
      </div>

      {/* Column Content */}
      <div
        className={
          isVertical
            ? "flex-1 p-2 flex flex-wrap gap-2"
            : "flex-1 overflow-y-auto p-2 space-y-2 min-h-[200px]"
        }
      >
        {features.map((feature, index) => (
          <div key={feature.id}>
            {/* Drop indicator before this card */}
            {isDropTarget && dropTarget.index === index && (
              <div className="h-0.5 bg-blue-500 rounded-full mx-1 mb-1" />
            )}
            <div
              draggable
              onDragStart={(e) => onDragStart(e, feature)}
              onDragOver={(e) => onDragOverCard(e, column.id, index)}
              onDragEnd={onDragEnd}
              className={`${isVertical ? "w-64" : ""} ${
                draggedFeature?.id === feature.id ? "opacity-40" : ""
              }`}
            >
              <FeatureCard feature={feature} onClick={() => onFeatureClick(feature)} />
            </div>
          </div>
        ))}

        {/* Drop indicator at end of list */}
        {isDropTarget && dropTarget.index === features.length && features.length > 0 && (
          <div className="h-0.5 bg-blue-500 rounded-full mx-1" />
        )}

        {features.length === 0 && (
          <div className={isVertical ? "text-sm text-zinc-400 dark:text-zinc-500 py-4" : "text-center py-8 text-sm text-zinc-400 dark:text-zinc-500"}>
            No features
          </div>
        )}
      </div>
    </div>
  )
}
