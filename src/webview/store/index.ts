import { create } from 'zustand'
import type { Feature, FeatureStatus, KanbanColumn, Priority, CardDisplaySettings } from '../../shared/types'

export type DueDateFilter = 'all' | 'overdue' | 'today' | 'this-week' | 'no-date'
export type LayoutMode = 'horizontal' | 'vertical'

interface KanbanState {
  features: Feature[]
  columns: KanbanColumn[]
  isDarkMode: boolean
  searchQuery: string
  priorityFilter: Priority | 'all'
  assigneeFilter: string | 'all'
  labelFilter: string | 'all'
  dueDateFilter: DueDateFilter
  layout: LayoutMode
  cardSettings: CardDisplaySettings
  collapsedColumns: Set<string>

  setFeatures: (features: Feature[]) => void
  setColumns: (columns: KanbanColumn[]) => void
  setIsDarkMode: (dark: boolean) => void
  setCardSettings: (settings: CardDisplaySettings) => void
  setSearchQuery: (query: string) => void
  setPriorityFilter: (priority: Priority | 'all') => void
  setAssigneeFilter: (assignee: string | 'all') => void
  setLabelFilter: (label: string | 'all') => void
  setDueDateFilter: (filter: DueDateFilter) => void
  setLayout: (layout: LayoutMode) => void
  toggleLayout: () => void
  setCollapsedColumns: (ids: string[]) => void
  toggleColumnCollapsed: (columnId: string) => void
  clearAllFilters: () => void

  addFeature: (feature: Feature) => void
  updateFeature: (id: string, updates: Partial<Feature>) => void
  removeFeature: (id: string) => void
  getFeaturesByStatus: (status: FeatureStatus) => Feature[]
  getFilteredFeaturesByStatus: (status: FeatureStatus) => Feature[]
  getUniqueAssignees: () => string[]
  getUniqueLabels: () => string[]
  hasActiveFilters: () => boolean
}

const getInitialDarkMode = (): boolean => {
  // Check for VSCode theme
  if (typeof document !== 'undefined') {
    return document.body.classList.contains('vscode-dark') ||
           document.body.classList.contains('vscode-high-contrast')
  }
  return false
}

const isToday = (date: Date): boolean => {
  const today = new Date()
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  )
}

const isThisWeek = (date: Date): boolean => {
  const today = new Date()
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay())
  startOfWeek.setHours(0, 0, 0, 0)

  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 7)

  return date >= startOfWeek && date < endOfWeek
}

const isOverdue = (date: Date): boolean => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date < today
}

export const useStore = create<KanbanState>((set, get) => ({
  features: [],
  columns: [],
  isDarkMode: getInitialDarkMode(),
  searchQuery: '',
  priorityFilter: 'all',
  assigneeFilter: 'all',
  labelFilter: 'all',
  dueDateFilter: 'all',
  layout: 'horizontal',
  collapsedColumns: new Set<string>(),
  cardSettings: {
    showPriorityBadges: true,
    showAssignee: true,
    showDueDate: true,
    showLabels: true,
    showBuildWithAI: true,
    showFileName: false,
    compactMode: false,
    markdownEditorMode: false,
    defaultPriority: 'medium',
    defaultStatus: 'backlog'
  },

  setFeatures: (features) => set({ features }),
  setColumns: (columns) => set({ columns }),
  setIsDarkMode: (dark) => set({ isDarkMode: dark }),
  setCardSettings: (settings) => set({ cardSettings: settings }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setPriorityFilter: (priority) => set({ priorityFilter: priority }),
  setAssigneeFilter: (assignee) => set({ assigneeFilter: assignee }),
  setLabelFilter: (label) => set({ labelFilter: label }),
  setDueDateFilter: (filter) => set({ dueDateFilter: filter }),
  setLayout: (layout) => set({ layout }),
  toggleLayout: () => set((state) => ({ layout: state.layout === 'horizontal' ? 'vertical' : 'horizontal' })),
  setCollapsedColumns: (ids) => set({ collapsedColumns: new Set(ids) }),
  toggleColumnCollapsed: (columnId) => set((state) => {
    const next = new Set(state.collapsedColumns)
    if (next.has(columnId)) {
      next.delete(columnId)
    } else {
      next.add(columnId)
    }
    return { collapsedColumns: next }
  }),

  clearAllFilters: () =>
    set({
      searchQuery: '',
      priorityFilter: 'all',
      assigneeFilter: 'all',
      labelFilter: 'all',
      dueDateFilter: 'all'
    }),

  addFeature: (feature) =>
    set((state) => ({
      features: [...state.features, feature]
    })),

  updateFeature: (id, updates) =>
    set((state) => ({
      features: state.features.map((f) => (f.id === id ? { ...f, ...updates } : f))
    })),

  removeFeature: (id) =>
    set((state) => ({
      features: state.features.filter((f) => f.id !== id)
    })),

  getFeaturesByStatus: (status) => {
    const { features } = get()
    return features
      .filter((f) => f.status === status)
      .sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0))
  },

  getFilteredFeaturesByStatus: (status) => {
    const {
      features,
      searchQuery,
      priorityFilter,
      assigneeFilter,
      labelFilter,
      dueDateFilter
    } = get()

    return features
      .filter((f) => {
        if (f.status !== status) return false

        // Priority filter
        if (priorityFilter !== 'all' && f.priority !== priorityFilter) return false

        // Assignee filter
        if (assigneeFilter !== 'all') {
          if (assigneeFilter === 'unassigned') {
            if (f.assignee) return false
          } else if (f.assignee !== assigneeFilter) {
            return false
          }
        }

        // Label filter
        if (labelFilter !== 'all' && !f.labels.includes(labelFilter)) return false

        // Due date filter
        if (dueDateFilter !== 'all') {
          if (dueDateFilter === 'no-date') {
            if (f.dueDate) return false
          } else if (!f.dueDate) {
            return false
          } else {
            const dueDate = new Date(f.dueDate)
            if (dueDateFilter === 'overdue' && !isOverdue(dueDate)) return false
            if (dueDateFilter === 'today' && !isToday(dueDate)) return false
            if (dueDateFilter === 'this-week' && !isThisWeek(dueDate)) return false
          }
        }

        // Search query
        if (searchQuery) {
          const query = searchQuery.toLowerCase()
          return (
            f.content.toLowerCase().includes(query) ||
            f.id.toLowerCase().includes(query) ||
            (f.assignee && f.assignee.toLowerCase().includes(query)) ||
            f.labels.some((l) => l.toLowerCase().includes(query))
          )
        }

        return true
      })
      .sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0))
  },

  getUniqueAssignees: () => {
    const { features } = get()
    const assignees = new Set<string>()
    features.forEach((f) => {
      if (f.assignee) assignees.add(f.assignee)
    })
    return Array.from(assignees).sort()
  },

  getUniqueLabels: () => {
    const { features } = get()
    const labels = new Set<string>()
    features.forEach((f) => {
      f.labels.forEach((l) => labels.add(l))
    })
    return Array.from(labels).sort()
  },

  hasActiveFilters: () => {
    const {
      searchQuery,
      priorityFilter,
      assigneeFilter,
      labelFilter,
      dueDateFilter
    } = get()
    return (
      searchQuery !== '' ||
      priorityFilter !== 'all' ||
      assigneeFilter !== 'all' ||
      labelFilter !== 'all' ||
      dueDateFilter !== 'all'
    )
  }
}))
