import { useEffect, useState, useRef, useCallback } from 'react'
import { generateKeyBetween } from 'fractional-indexing'
import { useStore } from './store'
import { KanbanBoard } from './components/KanbanBoard'
import { CreateFeatureDialog } from './components/CreateFeatureDialog'
import { FeatureEditor } from './components/FeatureEditor'
import { Toolbar } from './components/Toolbar'
import { UndoToast } from './components/UndoToast'
import type { Feature, FeatureStatus, Priority, ExtensionMessage, FeatureFrontmatter } from '../shared/types'
import { getTitleFromContent } from '../shared/types'
import { vscode } from './vscodeApi'

function App(): React.JSX.Element {

  const {
    columns,
    setFeatures,
    setColumns,
    setIsDarkMode,
    setCardSettings,
    setCollapsedColumns
  } = useStore()

  const [createFeatureOpen, setCreateFeatureOpen] = useState(false)
  const [createFeatureStatus, setCreateFeatureStatus] = useState<FeatureStatus>('backlog')

  // Editor state
  const contentVersionRef = useRef(0)
  const [editingFeature, setEditingFeature] = useState<{
    id: string
    content: string
    frontmatter: FeatureFrontmatter
    contentVersion: number
  } | null>(null)

  // Undo delete stack
  const [pendingDeletes, setPendingDeletes] = useState<{ id: string; feature: Feature }[]>([])
  const pendingDeletesRef = useRef(pendingDeletes)
  useEffect(() => {
    pendingDeletesRef.current = pendingDeletes
  }, [pendingDeletes])

  const nextIdRef = useRef(0)

  const handleDeleteFeatureFromCard = useCallback((featureId: string) => {
    const { features } = useStore.getState()
    const feature = features.find(f => f.id === featureId)
    if (!feature) return

    // Optimistically remove from local state
    setFeatures(features.filter(f => f.id !== featureId))

    // Close editor if this feature is open
    if (editingFeature?.id === featureId) {
      setEditingFeature(null)
    }

    // Push onto the undo stack
    const id = String(nextIdRef.current++)
    setPendingDeletes(prev => [...prev, { id, feature }])
  }, [editingFeature, setFeatures])

  const commitDelete = useCallback((entryId: string) => {
    const entry = pendingDeletesRef.current.find(d => d.id === entryId)
    if (!entry) return
    vscode.postMessage({ type: 'deleteFeature', featureId: entry.feature.id })
    setPendingDeletes(prev => prev.filter(d => d.id !== entryId))
  }, [])

  const handleUndoDelete = useCallback((entryId: string) => {
    const entry = pendingDeletesRef.current.find(d => d.id === entryId)
    if (!entry) return
    // Restore the feature
    const { features } = useStore.getState()
    setFeatures([...features, entry.feature])
    setPendingDeletes(prev => prev.filter(d => d.id !== entryId))
  }, [setFeatures])

  const handleUndoLatest = useCallback(() => {
    const stack = pendingDeletesRef.current
    if (stack.length === 0) return
    handleUndoDelete(stack[stack.length - 1].id)
  }, [handleUndoDelete])

  // Keyboard shortcuts
  useEffect(() => {
    let altPressedAlone = false
    let altDownTimer: ReturnType<typeof setTimeout> | null = null

    const handleKeyDown = (e: KeyboardEvent) => {
      // Track bare ALT press to forward to VS Code menu bar
      if (e.key === 'Alt') {
        altPressedAlone = true
        // If ALT is held >1s it's likely a modifier hold or window drag, not a menu toggle
        if (altDownTimer) clearTimeout(altDownTimer)
        altDownTimer = setTimeout(() => { altPressedAlone = false }, 1000)
        return
      }
      if (e.altKey) {
        altPressedAlone = false
        if (altDownTimer) { clearTimeout(altDownTimer); altDownTimer = null }
      }

      // Ctrl/Cmd+Z to undo delete (works even in inputs)
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey && pendingDeletesRef.current.length > 0) {
        e.preventDefault()
        handleUndoLatest()
        return
      }

      // Ignore if user is typing in an input or contentEditable (e.g. TipTap editor)
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return
      }

      switch (e.key) {
        case 'n':
          if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) {
            return
          }
          e.preventDefault()
          setCreateFeatureStatus('backlog')
          setCreateFeatureOpen(true)
          break
        case 'Escape':
          if (createFeatureOpen) {
            setCreateFeatureOpen(false)
          }
          break
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt' && altPressedAlone) {
        altPressedAlone = false
        if (altDownTimer) { clearTimeout(altDownTimer); altDownTimer = null }
        vscode.postMessage({ type: 'focusMenuBar' })
      }
    }

    // Cancel ALT-alone if mouse is clicked while ALT is held (e.g. ALT+click window drag on Linux)
    const handleMouseDown = () => { altPressedAlone = false }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('mousedown', handleMouseDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('mousedown', handleMouseDown)
      if (altDownTimer) clearTimeout(altDownTimer)
    }
  }, [createFeatureOpen, handleUndoLatest])

  // Listen for VSCode theme changes
  useEffect(() => {
    const updateTheme = () => {
      const isDark = document.body.classList.contains('vscode-dark') ||
                     document.body.classList.contains('vscode-high-contrast')
      setIsDarkMode(isDark)
      if (isDark) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }

    updateTheme()

    // Watch for class changes on body
    const observer = new MutationObserver(updateTheme)
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })

    return () => observer.disconnect()
  }, [setIsDarkMode])

  // Listen for messages from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent<ExtensionMessage>) => {
      const message = event.data
      if (!message || typeof message.type !== 'string') return

      switch (message.type) {
        case 'init':
          setFeatures(message.features)
          setColumns(message.columns)
          setCollapsedColumns(message.collapsedColumns ?? [])
          if (message.settings) {
            if (message.settings.markdownEditorMode && editingFeature) {
              setEditingFeature(null)
            }
            setCardSettings(message.settings)
          }
          break
        case 'featuresUpdated':
          setFeatures(message.features)
          break
        case 'triggerCreateDialog':
          setCreateFeatureStatus('backlog')
          setCreateFeatureOpen(true)
          break
        case 'featureContent': {
          const { cardSettings } = useStore.getState()
          if (cardSettings.markdownEditorMode) break
          contentVersionRef.current += 1
          setEditingFeature({
            id: message.featureId,
            content: message.content,
            frontmatter: message.frontmatter,
            contentVersion: contentVersionRef.current
          })
          break
        }
      }
    }

    window.addEventListener('message', handleMessage)

    // Tell extension we're ready
    vscode.postMessage({ type: 'ready' })

    return () => window.removeEventListener('message', handleMessage)
  }, [setFeatures, setColumns, setCardSettings, setCollapsedColumns])

  const handleFeatureClick = (feature: Feature): void => {
    // Request feature content for inline editing
    vscode.postMessage({
      type: 'openFeature',
      featureId: feature.id
    })
  }

  const handleSaveFeature = (content: string, frontmatter: FeatureFrontmatter): void => {
    if (!editingFeature) return
    vscode.postMessage({
      type: 'saveFeatureContent',
      featureId: editingFeature.id,
      content,
      frontmatter
    })
  }

  const handleCloseEditor = (): void => {
    setEditingFeature(null)
    vscode.postMessage({ type: 'closeFeature' })
  }

  const handleDeleteFeature = (): void => {
    if (!editingFeature) return
    handleDeleteFeatureFromCard(editingFeature.id)
  }

  const handleOpenFile = (): void => {
    if (!editingFeature) return
    vscode.postMessage({ type: 'openFile', featureId: editingFeature.id })
  }

  const handleStartWithAI = (agent: 'claude' | 'codex' | 'opencode', permissionMode: 'default' | 'plan' | 'acceptEdits' | 'bypassPermissions'): void => {
    vscode.postMessage({ type: 'startWithAI', agent, permissionMode })
  }

  const handleAddFeatureInColumn = (status: string): void => {
    setCreateFeatureStatus(status as FeatureStatus)
    setCreateFeatureOpen(true)
  }

  const handleCreateFeature = (data: {
    status: FeatureStatus
    priority: Priority
    content: string
  }): void => {
    vscode.postMessage({
      type: 'createFeature',
      data
    })
  }

  const handleMoveFeature = (
    featureId: string,
    newStatus: string,
    newOrder: number
  ): void => {
    // Optimistic update: compute fractional index locally before server confirms
    const { features } = useStore.getState()
    const feature = features.find(f => f.id === featureId)
    if (feature) {
      // Get sorted target column features (excluding the moved feature)
      const targetColumn = features
        .filter(f => f.status === newStatus && f.id !== featureId)
        .sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0))

      const clampedOrder = Math.max(0, Math.min(newOrder, targetColumn.length))
      const before = clampedOrder > 0 ? targetColumn[clampedOrder - 1].order : null
      const after = clampedOrder < targetColumn.length ? targetColumn[clampedOrder].order : null
      const newOrderKey = generateKeyBetween(before, after)

      const updated = features.map(f =>
        f.id === featureId
          ? { ...f, status: newStatus as FeatureStatus, order: newOrderKey }
          : f
      )
      setFeatures(updated)
    }

    // Tell extension to persist
    vscode.postMessage({
      type: 'moveFeature',
      featureId,
      newStatus,
      newOrder
    })
  }

  // Show loading if no columns yet
  if (columns.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-[var(--vscode-editor-background)]">
        <div className="text-[var(--vscode-foreground)] opacity-60">Loading...</div>
      </div>
    )
  }

  return (
    <div className="h-full w-full flex flex-col bg-[var(--vscode-editor-background)]">
      <Toolbar onOpenSettings={() => vscode.postMessage({ type: 'openSettings' })} />
      <div className="flex-1 flex overflow-hidden">
        <div className={editingFeature ? 'w-1/2' : 'w-full'}>
          <KanbanBoard
            onFeatureClick={handleFeatureClick}
            onAddFeature={handleAddFeatureInColumn}
            onMoveFeature={handleMoveFeature}
          />
        </div>
        {editingFeature && (
          <div className="w-1/2">
            <FeatureEditor
              featureId={editingFeature.id}
              content={editingFeature.content}
              frontmatter={editingFeature.frontmatter}
              contentVersion={editingFeature.contentVersion}
              onSave={handleSaveFeature}
              onClose={handleCloseEditor}
              onDelete={handleDeleteFeature}
              onOpenFile={handleOpenFile}
              onStartWithAI={handleStartWithAI}
            />
          </div>
        )}
      </div>

      <CreateFeatureDialog
        isOpen={createFeatureOpen}
        onClose={() => setCreateFeatureOpen(false)}
        onCreate={handleCreateFeature}
        initialStatus={createFeatureStatus}
      />

      {pendingDeletes.map((entry, i) => (
        <UndoToast
          key={entry.id}
          message={`Deleted "${getTitleFromContent(entry.feature.content)}"`}
          onUndo={() => handleUndoDelete(entry.id)}
          onExpire={() => commitDelete(entry.id)}
          duration={5000}
          index={i}
        />
      ))}
    </div>
  )
}

export default App
