import { useEffect, useState } from 'react'
import { Undo2 } from 'lucide-react'

interface UndoToastProps {
  message: string
  onUndo: () => void
  duration: number
}

export function UndoToast({ message, onUndo, duration }: UndoToastProps) {
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    const interval = 50
    const step = (interval / duration) * 100
    const timer = setInterval(() => {
      setProgress(prev => {
        const next = prev - step
        return next <= 0 ? 0 : next
      })
    }, interval)

    return () => clearInterval(timer)
  }, [duration])

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-zinc-800 dark:bg-zinc-700 text-white rounded-lg shadow-lg pl-4 pr-2 py-2 min-w-[280px] max-w-[400px]">
      <span className="text-sm truncate flex-1">{message}</span>
      <button
        onClick={onUndo}
        className="flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded hover:bg-zinc-600 dark:hover:bg-zinc-500 text-blue-400 hover:text-blue-300 transition-colors shrink-0"
      >
        <Undo2 size={14} />
        Undo
      </button>
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-600 dark:bg-zinc-500 rounded-b-lg overflow-hidden">
        <div
          className="h-full bg-blue-400 transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
