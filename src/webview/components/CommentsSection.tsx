import { useState } from 'react'
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react'
import type { TaskComment } from '../../shared/comments'
import { t } from '../lib/i18n'

interface CommentsSectionProps {
  comments: TaskComment[]
  defaultAuthor: string
  onChange: (comments: TaskComment[]) => void
}

export function CommentsSection({ comments, defaultAuthor, onChange }: CommentsSectionProps) {
  const [newContent, setNewContent] = useState('')
  const [newAuthor, setNewAuthor] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editContent, setEditContent] = useState('')

  const addComment = () => {
    const content = newContent.trim()
    if (!content) return
    const author = (newAuthor.trim() || defaultAuthor || '').trim()
    onChange([...comments, { dateTime: new Date().toISOString(), content, author }])
    setNewContent('')
  }

  const removeComment = (index: number) => {
    onChange(comments.filter((_, i) => i !== index))
  }

  const startEdit = (index: number) => {
    setEditingIndex(index)
    setEditContent(comments[index].content)
  }

  const commitEdit = () => {
    if (editingIndex === null) return
    const content = editContent.trim()
    if (content) {
      onChange(comments.map((c, i) => (i === editingIndex ? { ...c, content } : c)))
    }
    setEditingIndex(null)
  }

  return (
    <div
      className="px-4 py-3"
      style={{ borderTop: '1px solid var(--vscode-panel-border)' }}
    >
      <div
        className="text-[11px] font-semibold uppercase tracking-wide mb-2"
        style={{ color: 'var(--vscode-descriptionForeground)' }}
      >
        {t('comments.heading')}
      </div>

      {comments.length > 0 && (
        <table className="w-full text-xs mb-2" style={{ color: 'var(--vscode-foreground)' }}>
          <thead>
            <tr
              className="text-left text-[10px]"
              style={{ color: 'var(--vscode-descriptionForeground)' }}
            >
              <th className="pr-2 py-1 font-medium whitespace-nowrap">{t('comments.dateTime')}</th>
              <th className="pr-2 py-1 font-medium w-full">{t('comments.content')}</th>
              <th className="pr-2 py-1 font-medium whitespace-nowrap">{t('comments.author')}</th>
              <th className="py-1 font-medium w-8" />
            </tr>
          </thead>
          <tbody>
            {comments.map((comment, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--vscode-panel-border)' }}>
                <td className="pr-2 py-1.5 whitespace-nowrap align-top">
                  {new Date(comment.dateTime).toLocaleString()}
                </td>
                <td className="pr-2 py-1.5 align-top">
                  {editingIndex === i ? (
                    <input
                      type="text"
                      value={editContent}
                      autoFocus
                      onChange={(e) => setEditContent(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEdit()
                        if (e.key === 'Escape') setEditingIndex(null)
                      }}
                      className="w-full bg-transparent border-none outline-none text-xs"
                      style={{ color: 'var(--vscode-foreground)' }}
                    />
                  ) : (
                    comment.content
                  )}
                </td>
                <td className="pr-2 py-1.5 whitespace-nowrap align-top">{comment.author}</td>
                <td className="py-1.5 align-top">
                  <div className="flex items-center gap-1">
                    {editingIndex === i ? (
                      <>
                        <button
                          onClick={commitEdit}
                          className="p-0.5 rounded transition-colors vscode-hover-bg"
                          style={{ color: 'var(--vscode-descriptionForeground)' }}
                          title={t('comments.save')}
                        >
                          <Check size={12} />
                        </button>
                        <button
                          onClick={() => setEditingIndex(null)}
                          className="p-0.5 rounded transition-colors vscode-hover-bg"
                          style={{ color: 'var(--vscode-descriptionForeground)' }}
                          title={t('comments.cancel')}
                        >
                          <X size={12} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEdit(i)}
                          className="p-0.5 rounded transition-colors vscode-hover-bg"
                          style={{ color: 'var(--vscode-descriptionForeground)' }}
                          title={t('comments.edit')}
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => removeComment(i)}
                          className="p-0.5 rounded transition-colors vscode-hover-bg hover:text-red-500"
                          style={{ color: 'var(--vscode-descriptionForeground)' }}
                          title={t('comments.delete')}
                        >
                          <Trash2 size={12} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addComment()
          }}
          placeholder={t('comments.placeholder')}
          className="flex-1 min-w-0 px-2 py-1 text-xs rounded"
          style={{
            background: 'var(--vscode-input-background)',
            color: 'var(--vscode-input-foreground)',
            border: '1px solid var(--vscode-input-border, transparent)'
          }}
        />
        <input
          type="text"
          value={newAuthor}
          onChange={(e) => setNewAuthor(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addComment()
          }}
          placeholder={defaultAuthor || t('comments.authorPlaceholder')}
          className="w-24 px-2 py-1 text-xs rounded"
          style={{
            background: 'var(--vscode-input-background)',
            color: 'var(--vscode-input-foreground)',
            border: '1px solid var(--vscode-input-border, transparent)'
          }}
        />
        <button
          onClick={addComment}
          disabled={!newContent.trim()}
          className="p-1.5 rounded transition-colors vscode-hover-bg disabled:opacity-40"
          style={{ color: 'var(--vscode-foreground)' }}
          title={t('comments.add')}
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  )
}
