import { useState, useCallback } from 'react'
import { KanbanColumn } from './KanbanColumn'
import { useStore } from '../store'
import type { Feature, FeatureStatus, Priority } from '../../shared/types'

interface KanbanBoardProps {
  onFeatureClick: (feature: Feature) => void
  onAddFeature: (status: string) => void
  onMoveFeature: (featureId: string, newStatus: string, newOrder: number) => void
  onQuickAdd: (data: { status: FeatureStatus; priority: Priority; content: string }) => void
}

export function KanbanBoard({ onFeatureClick, onAddFeature, onMoveFeature, onQuickAdd }: KanbanBoardProps) {
  const columns = useStore((s) => s.columns)
  const getFilteredFeaturesByStatus = useStore((s) => s.getFilteredFeaturesByStatus)
  const layout = useStore((s) => s.layout)
  const [draggedFeature, setDraggedFeature] = useState<Feature | null>(null)

  const handleDragStart = useCallback((e: React.DragEvent, feature: Feature) => {
    setDraggedFeature(feature)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', feature.id)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent, newStatus: string) => {
      e.preventDefault()

      if (!draggedFeature) return
      if (draggedFeature.status === newStatus) {
        setDraggedFeature(null)
        return
      }

      const featuresInColumn = getFilteredFeaturesByStatus(newStatus as FeatureStatus)
      const newOrder = featuresInColumn.length

      onMoveFeature(draggedFeature.id, newStatus, newOrder)
      setDraggedFeature(null)
    },
    [draggedFeature, getFilteredFeaturesByStatus, onMoveFeature]
  )

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
            onQuickAdd={onQuickAdd}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            layout={layout}
          />
        ))}
      </div>
    </div>
  )
}
