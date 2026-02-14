import { useEffect, useState } from 'react'

interface UndoToastProps {
  message: string
  onUndo: () => void
  onExpire: () => void
  duration: number
  index: number
}

export function UndoToast({ message, onUndo, onExpire, duration, index }: UndoToastProps) {
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    const interval = 50
    const step = (interval / duration) * 100
    const timer = setInterval(() => {
      setProgress(prev => {
        const next = prev - step
        if (next <= 0) {
          clearInterval(timer)
          return 0
        }
        return next
      })
    }, interval)

    return () => clearInterval(timer)
  }, [duration])

  useEffect(() => {
    if (progress <= 0) {
      onExpire()
    }
  }, [progress, onExpire])

  return (
    <div
      className="fixed right-4 z-50 flex flex-col min-w-[320px] max-w-[420px] shadow-[0_4px_16px_rgba(0,0,0,0.4)] transition-[bottom] duration-200 ease-out"
      style={{
        bottom: `${24 + index * 52}px`,
        background: 'var(--vscode-notifications-background)',
        color: 'var(--vscode-notifications-foreground)',
        border: '1px solid var(--vscode-notifications-border, var(--vscode-widget-border))',
      }}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="text-[13px] leading-snug flex-1 truncate">{message}</span>
        <button
          onClick={onUndo}
          className="text-[13px] px-2 py-0.5 shrink-0"
          style={{
            background: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--vscode-button-hoverBackground)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--vscode-button-background)'}
        >
          Undo
        </button>
      </div>
      <div className="h-[2px] w-full" style={{ background: 'var(--vscode-widget-border)' }}>
        <div
          className="h-full transition-none"
          style={{ width: `${progress}%`, background: 'var(--vscode-progressBar-background)' }}
        />
      </div>
    </div>
  )
}
