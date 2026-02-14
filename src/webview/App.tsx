import { useEffect, useState, useRef, useCallback } from 'react'
import { useStore } from './store'
import { KanbanBoard } from './components/KanbanBoard'
import { CreateFeatureDialog } from './components/CreateFeatureDialog'
import { FeatureEditor } from './components/FeatureEditor'
import { Toolbar } from './components/Toolbar'
import { UndoToast } from './components/UndoToast'
import type { Feature, FeatureStatus, Priority, ExtensionMessage, FeatureFrontmatter, GitHubComment, GitHubReactions } from '../shared/types'
import { getTitleFromContent } from '../shared/types'

// Declare vscode API type
declare const acquireVsCodeApi: () => {
  postMessage: (message: unknown) => void
  getState: () => unknown
  setState: (state: unknown) => void
}

const vscode = acquireVsCodeApi()

function App(): React.JSX.Element {

  const {
    columns,
    setFeatures,
    setColumns,
    setIsDarkMode,
    setCardSettings,
    setSyncStatus,
    setGitHubConnected
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

  // Issue comments for GitHub-synced features
  const [issueCommentsData, setIssueCommentsData] = useState<{
    featureId: string
    comments: GitHubComment[]
    issueBody: string
    issueAuthor: string
    issueAuthorAvatar: string
    issueCreatedAt: string
    issueReactions: GitHubReactions
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

    const handleKeyDown = (e: KeyboardEvent) => {
      // Track bare ALT press to forward to VS Code menu bar
      if (e.key === 'Alt') {
        altPressedAlone = true
        return
      }
      if (e.altKey) {
        altPressedAlone = false
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
        vscode.postMessage({ type: 'focusMenuBar' })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
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
          if (message.settings) {
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
        case 'featureContent':
          contentVersionRef.current += 1
          setEditingFeature({
            id: message.featureId,
            content: message.content,
            frontmatter: message.frontmatter,
            contentVersion: contentVersionRef.current
          })
          // Clear stale comments when opening a different feature
          setIssueCommentsData(prev => prev?.featureId === message.featureId ? prev : null)
          break
        case 'issueComments':
          setIssueCommentsData({
            featureId: message.featureId,
            comments: message.comments,
            issueBody: message.issueBody,
            issueAuthor: message.issueAuthor,
            issueAuthorAvatar: message.issueAuthorAvatar,
            issueCreatedAt: message.issueCreatedAt,
            issueReactions: message.issueReactions
          })
          break
        case 'syncStatus':
          setSyncStatus(message.status)
          break
        case 'githubConnected':
          setGitHubConnected(message.connected)
          break
      }
    }

    window.addEventListener('message', handleMessage)

    // Tell extension we're ready
    vscode.postMessage({ type: 'ready' })

    return () => window.removeEventListener('message', handleMessage)
  }, [setFeatures, setColumns, setCardSettings, setSyncStatus, setGitHubConnected])

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
    setIssueCommentsData(null)
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
    // Optimistic reindex: reorder features locally before server confirms
    const { features } = useStore.getState()
    const feature = features.find(f => f.id === featureId)
    if (feature) {
      const oldStatus = feature.status
      const statusChanged = oldStatus !== newStatus

      // Remove from old column and get remaining sorted features
      const oldColumn = features
        .filter(f => f.status === oldStatus && f.id !== featureId)
        .sort((a, b) => a.order - b.order)

      // Get target column features (excluding moved feature)
      const targetColumn = statusChanged
        ? features.filter(f => f.status === newStatus).sort((a, b) => a.order - b.order)
        : oldColumn

      // Insert at target position
      const clampedOrder = Math.max(0, Math.min(newOrder, targetColumn.length))
      const movedFeature = { ...feature, status: newStatus as FeatureStatus, order: clampedOrder }
      targetColumn.splice(clampedOrder, 0, movedFeature)

      // Build updated features array with reindexed orders
      const updated = features.map(f => {
        if (f.id === featureId) {
          return movedFeature
        }
        const targetIdx = targetColumn.findIndex(t => t.id === f.id)
        if (targetIdx !== -1) {
          return { ...f, order: targetIdx }
        }
        if (statusChanged) {
          const oldIdx = oldColumn.findIndex(o => o.id === f.id)
          if (oldIdx !== -1) {
            return { ...f, order: oldIdx }
          }
        }
        return f
      })

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
      <Toolbar
        onSyncGitHub={() => vscode.postMessage({ type: 'syncGitHub' })}
        onUnlinkGitHub={() => vscode.postMessage({ type: 'unlinkGitHub' })}
      />
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
              issueComments={issueCommentsData?.featureId === editingFeature.id ? issueCommentsData : null}
              onSave={handleSaveFeature}
              onClose={handleCloseEditor}
              onDelete={handleDeleteFeature}
              onOpenFile={handleOpenFile}
              onStartWithAI={handleStartWithAI}
              onOpenGitHubIssue={(url) => vscode.postMessage({ type: 'openGitHubIssue', url })}
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
