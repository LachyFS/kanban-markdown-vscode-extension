import { Search, X, Columns, Rows, RefreshCw, Unlink } from 'lucide-react'
import { useStore, type DueDateFilter } from '../store'
import type { Priority } from '../../shared/types'

const priorities: { value: Priority | 'all'; label: string }[] = [
  { value: 'all', label: 'All Priorities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' }
]

const dueDateOptions: { value: DueDateFilter; label: string }[] = [
  { value: 'all', label: 'All Dates' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due Today' },
  { value: 'this-week', label: 'Due This Week' },
  { value: 'no-date', label: 'No Due Date' }
]

const selectClassName =
  'text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100'

interface ToolbarProps {
  onSyncGitHub?: () => void
  onUnlinkGitHub?: () => void
}

export function Toolbar({ onSyncGitHub, onUnlinkGitHub }: ToolbarProps) {
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
    cardSettings,
    syncStatus,
    githubConnected
  } = useStore()

  const assignees = getUniqueAssignees()
  const labels = getUniqueLabels()
  const filtersActive = hasActiveFilters()

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
          placeholder="Search features..."
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
          <option value="all">All Assignees</option>
          <option value="unassigned">Unassigned</option>
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
        <option value="all">All Labels</option>
        {labels.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
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
          title="Clear all filters"
        >
          <X size={14} />
          <span>Clear</span>
        </button>
      )}

      {/* GitHub Sync Button */}
      {onSyncGitHub && (
        githubConnected ? (
          <div className="flex items-center">
            <button
              onClick={onSyncGitHub}
              disabled={syncStatus === 'syncing'}
              className="flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-l-md transition-colors disabled:opacity-50 border border-r-0 border-zinc-200 dark:border-zinc-600"
              title={syncStatus === 'syncing' ? 'Syncing...' : 'Sync with GitHub'}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" className="opacity-60"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
              <RefreshCw size={13} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
            </button>
            {onUnlinkGitHub && (
              <button
                onClick={onUnlinkGitHub}
                className="flex items-center px-1.5 py-1.5 text-zinc-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-r-md transition-colors border border-zinc-200 dark:border-zinc-600"
                title="Unlink GitHub"
              >
                <Unlink size={13} />
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={onSyncGitHub}
            disabled={syncStatus === 'syncing'}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-800 dark:hover:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded-md transition-colors disabled:opacity-50"
            title="Sign in and sync with GitHub Issues"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
            <span>Sync GitHub</span>
          </button>
        )
      )}

      {/* Layout Toggle */}
      <button
        onClick={toggleLayout}
        className="flex items-center gap-1 px-2 py-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
        title={layout === 'horizontal' ? 'Switch to vertical layout' : 'Switch to horizontal layout'}
      >
        {layout === 'horizontal' ? <Rows size={16} /> : <Columns size={16} />}
      </button>

      {/* Keyboard hint */}
      <div className="ml-auto text-xs text-zinc-400">
        Press <kbd className="px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-700 rounded">n</kbd> to add
      </div>
    </div>
  )
}
