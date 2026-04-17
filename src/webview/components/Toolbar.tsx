import { Search, X, Columns, Rows, Settings, Tags, Layers } from 'lucide-react'
import { useStore, type DueDateFilter } from '../store'
import type { BoardViewMode, Priority } from '../../shared/types'
import { useState } from 'react'
import { LabelManager } from './LabelManager'
import { t } from '../lib/i18n'

function getPriorities(): { value: Priority | 'all'; label: string }[] {
  return [
    { value: 'all', label: t('toolbar.allPriorities') },
    { value: 'critical', label: t('priority.critical') },
    { value: 'high', label: t('priority.high') },
    { value: 'medium', label: t('priority.medium') },
    { value: 'low', label: t('priority.low') }
  ]
}

function getDueDateOptions(): { value: DueDateFilter; label: string }[] {
  return [
    { value: 'all', label: t('toolbar.allDates') },
    { value: 'overdue', label: t('toolbar.overdue') },
    { value: 'today', label: t('toolbar.dueToday') },
    { value: 'this-week', label: t('toolbar.dueThisWeek') },
    { value: 'no-date', label: t('toolbar.noDueDate') }
  ]
}

const selectClassName =
  'text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100'

export function Toolbar({
  onOpenSettings,
  boardViewMode,
  onBoardViewModeChange
}: {
  onOpenSettings: () => void
  boardViewMode: BoardViewMode
  onBoardViewModeChange: (mode: BoardViewMode) => void
}) {
  const {
    searchQuery,
    setSearchQuery,
    priorityFilter,
    setPriorityFilter,
    assigneeFilter,
    setAssigneeFilter,
    labelFilter,
    setLabelFilter,
    dueDateFilter,
    setDueDateFilter,
    clearAllFilters,
    getUniqueAssignees,
    getUniqueLabels,
    hasActiveFilters,
    layout,
    toggleLayout,
    cardSettings
  } = useStore()

  const priorities = getPriorities()
  const dueDateOptions = getDueDateOptions()
  const assignees = getUniqueAssignees()
  const labels = getUniqueLabels()
  const filtersActive = hasActiveFilters()

  const [labelManagerOpen, setLabelManagerOpen] = useState(false)

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 flex-wrap">
      {/* Search */}
      <div className="relative flex-1 min-w-[180px] max-w-xs">
        <Search
          size={14}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('toolbar.search')}
          className="w-full pl-8 pr-3 py-1.5 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
        />
      </div>

      {/* Priority Filter */}
      {cardSettings.showPriorityBadges && (
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as Priority | 'all')}
          className={selectClassName}
        >
          {priorities.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      )}

      {/* Assignee Filter */}
      {cardSettings.showAssignee && (
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className={selectClassName}
        >
          <option value="all">{t('toolbar.allAssignees')}</option>
          <option value="unassigned">{t('toolbar.unassigned')}</option>
          {assignees.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      )}

      {/* Label Filter */}
      {cardSettings.showLabels && (
      <select
        value={labelFilter}
        onChange={(e) => setLabelFilter(e.target.value)}
        className={selectClassName}
      >
        <option value="all">{t('toolbar.allLabels')}</option>
        <option value="unlabeled">{t('toolbar.unlabeled')}</option>
        {labels.length > 0 && (
          <optgroup label={t('toolbar.labelsGroup')}>
            {labels.map((l) => (
              <option key={l} value={`label:${l}`}>
                {l}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      )}

      {/* Due Date Filter */}
      {cardSettings.showDueDate && (
        <select
          value={dueDateFilter}
          onChange={(e) => setDueDateFilter(e.target.value as DueDateFilter)}
          className={selectClassName}
        >
          {dueDateOptions.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      )}

      {/* Clear Filters Button */}
      {filtersActive && (
        <button
          onClick={clearAllFilters}
          className="flex items-center gap-1 px-2 py-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
          title={t('toolbar.clearAllFilters')}
        >
          <X size={14} />
          <span>{t('toolbar.clear')}</span>
        </button>
      )}

      {/* Layout Toggle */}
      <button
        onClick={toggleLayout}
        className="flex items-center gap-1 px-2 py-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
        title={layout === 'horizontal' ? t('toolbar.switchToVertical') : t('toolbar.switchToHorizontal')}
      >
        {layout === 'horizontal' ? <Rows size={16} /> : <Columns size={16} />}
      </button>

      {/* Board: standard columns vs epic swim lanes */}
      <button
        type="button"
        onClick={() => onBoardViewModeChange(boardViewMode === 'standard' ? 'epic' : 'standard')}
        className={`flex items-center gap-1 px-2 py-1.5 text-sm rounded-md transition-colors ${
          boardViewMode === 'epic'
            ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40'
            : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
        }`}
        title={boardViewMode === 'standard' ? t('toolbar.epicBoardView') : t('toolbar.standardBoardView')}
      >
        <Layers size={16} />
      </button>

      {/* Manage Labels */}
      {cardSettings.showLabels && labels.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setLabelManagerOpen(!labelManagerOpen)}
            className="flex items-center gap-1 px-2 py-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
            title={t('toolbar.manageLabels')}
          >
            <Tags size={14} />
          </button>
          {labelManagerOpen && (
            <LabelManager onClose={() => setLabelManagerOpen(false)} />
          )}
        </div>
      )}

      {/* Settings */}
      <button
        onClick={onOpenSettings}
        className="flex items-center gap-1 px-2 py-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
        title={t('toolbar.openSettings')}
      >
        <Settings size={16} />
      </button>

      {/* Keyboard hint */}
      <div className="ml-auto text-xs text-zinc-400">
        {t('toolbar.pressKeyToAdd').split('{key}')[0]}<kbd className="px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-700 rounded">n</kbd>{t('toolbar.pressKeyToAdd').split('{key}')[1]}
      </div>
    </div>
  )
}
