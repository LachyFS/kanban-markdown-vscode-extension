import { useState, useCallback } from 'react'
import { KanbanColumn } from './KanbanColumn'
import { useStore } from '../store'
import type { Feature, FeatureStatus, Priority } from '../../shared/types'

export interface DropTarget {
  columnId: string
  index: number
}

interface KanbanBoardProps {
  onFeatureClick: (feature: Feature) => void
  onAddFeature: (status: string) => void
  onDeleteFeature: (featureId: string) => void
  onMoveFeature: (featureId: string, newStatus: string, newOrder: number) => void
  onQuickAdd: (data: { status: FeatureStatus; priority: Priority; content: string }) => void
}

export function KanbanBoard({ onFeatureClick, onAddFeature, onDeleteFeature, onMoveFeature, onQuickAdd }: KanbanBoardProps) {
  const columns = useStore((s) => s.columns)
  const getFilteredFeaturesByStatus = useStore((s) => s.getFilteredFeaturesByStatus)
  const layout = useStore((s) => s.layout)
  const [draggedFeature, setDraggedFeature] = useState<Feature | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)

  const handleDragStart = useCallback((e: React.DragEvent, feature: Feature) => {
    setDraggedFeature(feature)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', feature.id)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDragOverCard = useCallback(
    (e: React.DragEvent, columnId: string, cardIndex: number) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const midY = rect.top + rect.height / 2
      const insertIndex = e.clientY < midY ? cardIndex : cardIndex + 1

      setDropTarget((prev) => {
        if (prev && prev.columnId === columnId && prev.index === insertIndex) return prev
        return { columnId, index: insertIndex }
      })
    },
    []
  )

  const handleDrop = useCallback(
    (e: React.DragEvent, columnId: string) => {
      e.preventDefault()
      if (!draggedFeature) return

      const features = getFilteredFeaturesByStatus(columnId as FeatureStatus)
      let insertIndex: number

      if (dropTarget && dropTarget.columnId === columnId) {
        insertIndex = dropTarget.index
      } else {
        // Dropped on empty area of the column — append to end
        insertIndex = features.length
      }

      // Adjust index if dragging within the same column and moving downward
      if (draggedFeature.status === columnId) {
        const currentIndex = features.findIndex((f) => f.id === draggedFeature.id)
        if (currentIndex !== -1 && insertIndex > currentIndex) {
          insertIndex--
        }
        // No-op if dropping in the same position
        if (currentIndex === insertIndex) {
          setDraggedFeature(null)
          setDropTarget(null)
          return
        }
      }

      onMoveFeature(draggedFeature.id, columnId, insertIndex)
      setDraggedFeature(null)
      setDropTarget(null)
    },
    [draggedFeature, dropTarget, getFilteredFeaturesByStatus, onMoveFeature]
  )

  const handleDragEnd = useCallback(() => {
    setDraggedFeature(null)
    setDropTarget(null)
  }, [])

  const isVertical = layout === 'vertical'

  return (
    <div className={isVertical ? "h-full overflow-y-auto p-4" : "h-full overflow-x-auto p-4"}>
      <div className={isVertical ? "flex flex-col gap-4" : "flex gap-4 h-full min-w-max"}>
        {columns.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            features={getFilteredFeaturesByStatus(column.id as FeatureStatus)}
            onFeatureClick={onFeatureClick}
            onAddFeature={onAddFeature}
            onDeleteFeature={onDeleteFeature}
            onQuickAdd={onQuickAdd}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragOverCard={handleDragOverCard}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            draggedFeature={draggedFeature}
            dropTarget={dropTarget}
            layout={layout}
          />
        ))}
      </div>
    </div>
  )
}
