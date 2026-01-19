import { useState, useRef, useEffect } from 'react'
import { Plus } from 'lucide-react'
import type { FeatureStatus, Priority } from '../../shared/types'

interface QuickAddInputProps {
  status: FeatureStatus
  onAdd: (data: { status: FeatureStatus; priority: Priority; content: string }) => void
}

export function QuickAddInput({ status, onAdd }: QuickAddInputProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isEditing])

  const handleSubmit = () => {
    const title = value.trim()
    if (title) {
      // Build content with title as first # heading
      const content = `# ${title}`
      onAdd({
        status,
        priority: 'medium',
        content
      })
      setValue('')
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === 'Escape') {
      setValue('')
      setIsEditing(false)
    }
  }

  if (!isEditing) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
      >
        <Plus size={14} />
        <span>Add feature</span>
      </button>
    )
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleSubmit}
      onKeyDown={handleKeyDown}
      placeholder="Feature title..."
      className="w-full px-2 py-1.5 text-sm bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
    />
  )
}
