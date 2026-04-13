import { useMemo, useCallback } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { KanbanBoard } from './KanbanBoard'
import { useStore } from '../store'
import { vscode } from '../vscodeApi'
import type { Feature, FeatureStatus } from '../../shared/types'
import { epicLaneId } from '../../shared/types'
import { epicThemeFromName } from '../../shared/epicColor'
import { t } from '../lib/i18n'
import { cn } from '../lib/utils'

interface KanbanEpicBoardProps {
  onFeatureClick: (feature: Feature) => void
  onAddFeature: (status: string) => void
  onMoveFeature: (featureId: string, newStatus: string, newOrder: number) => void
}

export function KanbanEpicBoard({ onFeatureClick, onAddFeature, onMoveFeature }: KanbanEpicBoardProps) {
  const columns = useStore(s => s.columns)
  const features = useStore(s => s.features)
  const getUniqueEpics = useStore(s => s.getUniqueEpics)
  const getFilteredFeaturesByStatus = useStore(s => s.getFilteredFeaturesByStatus)
  const collapsedEpics = useStore(s => s.collapsedEpics)
  const toggleEpicCollapsed = useStore(s => s.toggleEpicCollapsed)
  const layout = useStore(s => s.layout)
  const isDarkMode = useStore(s => s.isDarkMode)

  const lanes = useMemo(() => {
    const named = getUniqueEpics()
    const hasUngrouped = features.some(f => !f.epic?.trim())
    const out: (string | null)[] = [...named]
    if (hasUngrouped) out.push(null)
    return out
  }, [features, getUniqueEpics])

  const handleToggleEpic = useCallback(
    (laneKey: string) => {
      toggleEpicCollapsed(laneKey)
      vscode.postMessage({ type: 'toggleEpicCollapsed', epicKey: laneKey })
    },
    [toggleEpicCollapsed]
  )

  const isVertical = layout === 'vertical'

  if (lanes.length === 0) {
    return (
      <div className="h-full overflow-auto p-4">
        <p className="text-sm" style={{ color: 'var(--vscode-descriptionForeground)' }}>
          {t('epic.emptyHint')}
        </p>
      </div>
    )
  }

  return (
    <div className={isVertical ? 'h-full overflow-y-auto p-4 space-y-6' : 'h-full overflow-y-auto p-4 space-y-6'}>
      {lanes.map((laneEpic) => {
        const laneKey = epicLaneId(laneEpic)
        const collapsed = collapsedEpics.has(laneKey)
        const title = laneEpic ?? t('epic.noEpic')
        const total = features.filter((f) => {
          const e = f.epic?.trim() || null
          if (laneEpic === null) return e === null
          return e === laneEpic
        }).length

        const laneTheme = laneEpic ? epicThemeFromName(laneEpic, isDarkMode) : null

        return (
          <section
            key={laneKey}
            className={cn(
              'rounded-lg overflow-hidden bg-zinc-50/50 dark:bg-zinc-900/30',
              !laneEpic && 'border border-zinc-200 dark:border-zinc-700'
            )}
            style={
              laneTheme
                ? {
                    borderWidth: 2,
                    borderStyle: 'solid',
                    borderColor: laneTheme.border
                  }
                : undefined
            }
          >
            <button
              type="button"
              onClick={() => handleToggleEpic(laneKey)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60"
            >
              {collapsed ? (
                <ChevronRight
                  size={16}
                  className={laneTheme ? undefined : 'text-zinc-500 dark:text-zinc-400'}
                  style={laneTheme ? { color: laneTheme.foreground } : undefined}
                />
              ) : (
                <ChevronDown
                  size={16}
                  className={laneTheme ? undefined : 'text-zinc-500 dark:text-zinc-400'}
                  style={laneTheme ? { color: laneTheme.foreground } : undefined}
                />
              )}
              <span
                className={cn('text-sm font-semibold', !laneTheme && 'text-zinc-900 dark:text-zinc-100')}
                style={laneTheme ? { color: laneTheme.foreground } : undefined}
              >
                {title}
              </span>
              <span
                className="text-xs px-1.5 py-0.5 rounded-full"
                style={{
                  background: 'var(--vscode-badge-background)',
                  color: 'var(--vscode-badge-foreground)',
                }}
              >
                {total}
              </span>
            </button>

            {collapsed ? (
              <CollapsedEpicSummary
                columns={columns}
                laneEpic={laneEpic}
                getFilteredFeaturesByStatus={getFilteredFeaturesByStatus}
                accentBorder={laneTheme?.border}
              />
            ) : (
              <div className={isVertical ? 'min-h-[200px]' : 'min-h-[280px]'}>
                <KanbanBoard
                  epicFilter={laneEpic}
                  onFeatureClick={onFeatureClick}
                  onAddFeature={onAddFeature}
                  onMoveFeature={onMoveFeature}
                />
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

function CollapsedEpicSummary({
  columns,
  laneEpic,
  getFilteredFeaturesByStatus,
  accentBorder
}: {
  columns: { id: string; name: string; color: string }[]
  laneEpic: string | null
  getFilteredFeaturesByStatus: (status: FeatureStatus, epicLane?: string | null) => Feature[]
  accentBorder?: string
}) {
  return (
    <div
      className={cn('px-3 py-2 flex flex-wrap gap-x-3 gap-y-1 border-t', !accentBorder && 'border-zinc-200 dark:border-zinc-700')}
      style={accentBorder ? { borderTopColor: accentBorder } : undefined}
    >
      {columns.map((col) => {
        const n = getFilteredFeaturesByStatus(col.id as FeatureStatus, laneEpic).length
        return (
          <span key={col.id} className="inline-flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
            <span className="font-medium text-zinc-700 dark:text-zinc-300">{col.name}</span>
            <span className="tabular-nums">{n}</span>
          </span>
        )
      })}
    </div>
  )
}
