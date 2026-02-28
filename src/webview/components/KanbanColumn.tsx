import { Plus, ChevronLeft, MoreVertical, ChevronRight } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { FeatureCard } from './FeatureCard'
import type { Feature, KanbanColumn as KanbanColumnType } from '../../shared/types'
import type { LayoutMode } from '../store'
import type { DropTarget } from './KanbanBoard'

interface KanbanColumnProps {
  column: KanbanColumnType
  features: Feature[]
  otherColumns: KanbanColumnType[]
  onFeatureClick: (feature: Feature) => void
  onAddFeature: (status: string) => void
  onCollapse: () => void
  onMoveAllCards: (targetColumnId: string) => void
  onArchiveAllCards?: () => void
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
  otherColumns,
  onFeatureClick,
  onAddFeature,
  onCollapse,
  onMoveAllCards,
  onArchiveAllCards,
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
  const [menuOpen, setMenuOpen] = useState(false)
  const [submenuOpen, setSubmenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

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
          <div ref={menuRef} className="relative flex">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              title="Column options"
            >
              <MoreVertical size={16} className="text-zinc-500" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px] bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg py-1">
                <div
                  className={`relative ${features.length === 0 ? 'opacity-40 pointer-events-none' : ''}`}
                  onMouseEnter={() => setSubmenuOpen(true)}
                  onMouseLeave={() => setSubmenuOpen(false)}
                >
                  <button
                    className="w-full text-left px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center justify-between gap-2"
                  >
                    <span>Move all cards in this list</span>
                    <ChevronRight size={14} className="text-zinc-400 flex-shrink-0" />
                  </button>
                  {submenuOpen && (
                    <div className="absolute left-full top-0 ml-0.5 z-50 min-w-[160px] bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg py-1">
                      {otherColumns.map((col) => (
                        <button
                          key={col.id}
                          className="w-full text-left px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2"
                          onClick={() => { onMoveAllCards(col.id); setMenuOpen(false); setSubmenuOpen(false) }}
                        >
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: col.color }} />
                          {col.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {onArchiveAllCards && (
                  <button
                    className={`w-full text-left px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 ${features.length === 0 ? 'opacity-40 pointer-events-none' : ''}`}
                    onClick={() => { onArchiveAllCards(); setMenuOpen(false) }}
                  >
                    Archive all cards in this list
                  </button>
                )}
              </div>
            )}
          </div>
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
