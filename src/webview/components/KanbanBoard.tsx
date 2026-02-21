import { useState, useCallback } from 'react'
import { KanbanColumn } from './KanbanColumn'
import { CollapsedColumn } from './CollapsedColumn'
import { useStore } from '../store'
import { vscode } from '../vscodeApi'
import type { Feature, FeatureStatus } from '../../shared/types'

export interface DropTarget {
  columnId: string
  index: number
}

interface KanbanBoardProps {
  onFeatureClick: (feature: Feature) => void
  onAddFeature: (status: string) => void
  onMoveFeature: (featureId: string, newStatus: string, newOrder: number) => void
}

export function KanbanBoard({ onFeatureClick, onAddFeature, onMoveFeature }: KanbanBoardProps) {
  const columns = useStore((s) => s.columns)
  const getFilteredFeaturesByStatus = useStore((s) => s.getFilteredFeaturesByStatus)
  const getFeaturesByStatus = useStore((s) => s.getFeaturesByStatus)
  const layout = useStore((s) => s.layout)
  const collapsedColumns = useStore((s) => s.collapsedColumns)
  const toggleColumnCollapsed = useStore((s) => s.toggleColumnCollapsed)
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

      const filteredFeatures = getFilteredFeaturesByStatus(columnId as FeatureStatus)
      let filteredInsertIndex: number

      if (dropTarget && dropTarget.columnId === columnId) {
        filteredInsertIndex = dropTarget.index
      } else {
        // Dropped on empty area of the column — append to end
        filteredInsertIndex = filteredFeatures.length
      }

      // Adjust index if dragging within the same column and moving downward
      if (draggedFeature.status === columnId) {
        const currentIndex = filteredFeatures.findIndex((f) => f.id === draggedFeature.id)
        if (currentIndex !== -1 && filteredInsertIndex > currentIndex) {
          filteredInsertIndex--
        }
        // No-op if dropping in the same position
        if (currentIndex === filteredInsertIndex) {
          setDraggedFeature(null)
          setDropTarget(null)
          return
        }
      }

      // Translate filtered index to unfiltered index
      const allFeatures = getFeaturesByStatus(columnId as FeatureStatus)
        .filter((f) => f.id !== draggedFeature.id)
      const filteredWithoutDragged = filteredFeatures.filter((f) => f.id !== draggedFeature.id)

      let unfilteredInsertIndex: number

      if (filteredWithoutDragged.length === 0) {
        // No visible features — append to end of unfiltered list
        unfilteredInsertIndex = allFeatures.length
      } else if (filteredInsertIndex >= filteredWithoutDragged.length) {
        // Inserting past end of filtered list — place after last visible feature
        const lastVisible = filteredWithoutDragged[filteredWithoutDragged.length - 1]
        const lastVisibleUnfilteredIdx = allFeatures.findIndex((f) => f.id === lastVisible.id)
        unfilteredInsertIndex = lastVisibleUnfilteredIdx + 1
      } else {
        // Find the anchor feature at the filtered insert position
        const anchorFeature = filteredWithoutDragged[filteredInsertIndex]
        unfilteredInsertIndex = allFeatures.findIndex((f) => f.id === anchorFeature.id)
      }

      onMoveFeature(draggedFeature.id, columnId, unfilteredInsertIndex)
      setDraggedFeature(null)
      setDropTarget(null)
    },
    [draggedFeature, dropTarget, getFilteredFeaturesByStatus, getFeaturesByStatus, onMoveFeature]
  )

  const handleDragEnd = useCallback(() => {
    setDraggedFeature(null)
    setDropTarget(null)
  }, [])

  const handleToggleCollapse = useCallback((columnId: string) => {
    toggleColumnCollapsed(columnId)
    vscode.postMessage({ type: 'toggleColumnCollapsed', columnId })
  }, [toggleColumnCollapsed])

  const isVertical = layout === 'vertical'

  return (
    <div className={isVertical ? "h-full overflow-y-auto p-4" : "h-full overflow-x-auto p-4"}>
      <div className={isVertical ? "flex flex-col gap-4" : "flex gap-4 h-full min-w-max"}>
        {columns.map((column) =>
          collapsedColumns.has(column.id) ? (
            <CollapsedColumn
              key={column.id}
              column={column}
              featureCount={getFeaturesByStatus(column.id as FeatureStatus).length}
              onExpand={() => handleToggleCollapse(column.id)}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              layout={layout}
            />
          ) : (
            <KanbanColumn
              key={column.id}
              column={column}
              features={getFilteredFeaturesByStatus(column.id as FeatureStatus)}
              onFeatureClick={onFeatureClick}
              onAddFeature={onAddFeature}
              onCollapse={() => handleToggleCollapse(column.id)}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragOverCard={handleDragOverCard}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              draggedFeature={draggedFeature}
              dropTarget={dropTarget}
              layout={layout}
            />
          )
        )}
      </div>
    </div>
  )
}
