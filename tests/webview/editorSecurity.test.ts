// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { Editor, mergeAttributes } from '@tiptap/react'
import { getMarkdown, markdownExtensions } from '../../src/webview/lib/markdownEditor'

describe('bundled Markdown editor', () => {
  it('preserves local and inline images and editable nested checklists through save/reopen', () => {
    const editor = new Editor({
      extensions: markdownExtensions('', () => 'https://file.vscode-resource.vscode-cdn.net/project/features/'),
      content: '# Card\n\n![Screenshot](../assets/screen%20shot.png "Title")\n\nBefore ![Inline](https://example.com/image.png) after.\n\n- [ ] Pending\n  - [x] Nested done\n- [x] Finished'
    })
    try {
      const images = editor.view.dom.querySelectorAll('img:not(.ProseMirror-separator)')
      expect(images).toHaveLength(2)
      expect(images[0].src).toBe('https://file.vscode-resource.vscode-cdn.net/project/assets/screen%20shot.png')
      expect(images[0].alt).toBe('Screenshot')
      expect(editor.view.dom.querySelectorAll('input[type=checkbox]')).toHaveLength(3)
      const checkbox = editor.view.dom.querySelector('input[type=checkbox]') as HTMLInputElement
      checkbox.checked = true
      checkbox.dispatchEvent(new Event('change', { bubbles: true }))
      editor.commands.insertContentAt(editor.state.doc.content.size, { type: 'paragraph', content: [{ type: 'text', text: 'Edited.' }] })
      const saved = getMarkdown(editor)
      expect(saved).toContain('![Screenshot](../assets/screen%20shot.png "Title")')
      expect(saved).toContain('Before ![Inline](https://example.com/image.png) after.')
      expect(saved).toContain('[x] Pending')
      expect(saved).toContain('[x] Nested done')
      expect(saved).toContain('[x] Finished')
      expect(saved).not.toContain('vscode-resource')
      editor.commands.setContent(saved)
      expect(editor.view.dom.querySelectorAll('input:checked')).toHaveLength(3)
      expect(editor.view.dom.querySelectorAll('img:not(.ProseMirror-separator)')).toHaveLength(2)
    } finally {
      editor.destroy()
    }
  })

  it('does not render raw HTML or load unsafe image schemes', () => {
    const editor = new Editor({
      extensions: markdownExtensions('', () => 'https://file.vscode-resource.vscode-cdn.net/project/'),
      content: '<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>'
    })
    try {
      expect(editor.view.dom.querySelector('script, [onerror]')).toBeNull()
      editor.commands.setImage({ src: 'command:workbench.action.terminal.new', alt: 'Blocked' })
      expect(editor.view.dom.querySelector('img')?.getAttribute('src')).toBeNull()
      expect(getMarkdown(editor)).toContain('command:workbench.action.terminal.new')
    } finally {
      editor.destroy()
    }
  })

  it('does not inherit executable DOM attributes from an own __proto__ key', () => {
    const attributes = mergeAttributes(JSON.parse('{"__proto__":{"onmouseover":"alert(1)"},"class":"card"}'))
    expect(attributes.onmouseover).toBeUndefined()
    expect(attributes.class).toBe('card')
  })

  it('renders and edits Markdown with the patched editor dependencies', () => {
    const editor = new Editor({
      extensions: markdownExtensions(''),
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
