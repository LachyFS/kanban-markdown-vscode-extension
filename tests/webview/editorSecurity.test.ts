// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { Editor, mergeAttributes } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'

describe('bundled Markdown editor', () => {
  it('does not inherit executable DOM attributes from an own __proto__ key', () => {
    const attributes = mergeAttributes(JSON.parse('{"__proto__":{"onmouseover":"alert(1)"},"class":"card"}'))
    expect(attributes.onmouseover).toBeUndefined()
    expect(attributes.class).toBe('card')
  })

  it('renders and edits Markdown with the patched editor dependencies', () => {
    const editor = new Editor({
      extensions: [StarterKit, Markdown.configure({ html: false, transformPastedText: true })],
      content: '# Security release\n\nKeep **formatting** and [links](https://example.com).\n\n- First task\n- Second task'
    })
    try {
      expect(editor.getHTML()).toContain('<h1>Security release</h1>')
      expect(editor.getHTML()).toContain('<strong>formatting</strong>')
      expect(editor.view.dom.querySelectorAll('li')).toHaveLength(2)
      editor.commands.insertContentAt(editor.state.doc.content.size, '<p>Updated safely.</p>')
      const markdown = (editor.storage as unknown as { markdown: { getMarkdown(): string } }).markdown.getMarkdown()
      expect(markdown).toContain('# Security release')
      expect(markdown).toContain('**formatting**')
      expect(markdown).toContain('[links](https://example.com)')
      expect(markdown).toContain('Updated safely.')
    } finally {
      editor.destroy()
    }
  })
})
