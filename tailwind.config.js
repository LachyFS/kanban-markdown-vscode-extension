import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/webview/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      typography: () => ({
        DEFAULT: {
          css: {
            '--tw-prose-body': 'var(--vscode-foreground)',
            '--tw-prose-headings': 'var(--vscode-foreground)',
            '--tw-prose-lead': 'var(--vscode-foreground)',
            '--tw-prose-links': 'var(--vscode-textLink-foreground)',
            '--tw-prose-bold': 'var(--vscode-foreground)',
            '--tw-prose-counters': 'var(--vscode-descriptionForeground)',
            '--tw-prose-bullets': 'var(--vscode-descriptionForeground)',
            '--tw-prose-hr': 'var(--vscode-panel-border)',
            '--tw-prose-quotes': 'var(--vscode-foreground)',
            '--tw-prose-quote-borders': 'var(--vscode-textBlockQuote-border)',
            '--tw-prose-captions': 'var(--vscode-descriptionForeground)',
            '--tw-prose-code': 'var(--vscode-textPreformat-foreground)',
            '--tw-prose-pre-code': 'var(--vscode-editor-foreground)',
            '--tw-prose-pre-bg': 'var(--vscode-textBlockQuote-background)',
            '--tw-prose-th-borders': 'var(--vscode-panel-border)',
            '--tw-prose-td-borders': 'var(--vscode-panel-border)',
            // Invert colors for dark mode handled by CSS variables
            '--tw-prose-invert-body': 'var(--vscode-foreground)',
            '--tw-prose-invert-headings': 'var(--vscode-foreground)',
            '--tw-prose-invert-lead': 'var(--vscode-foreground)',
            '--tw-prose-invert-links': 'var(--vscode-textLink-foreground)',
            '--tw-prose-invert-bold': 'var(--vscode-foreground)',
            '--tw-prose-invert-counters': 'var(--vscode-descriptionForeground)',
            '--tw-prose-invert-bullets': 'var(--vscode-descriptionForeground)',
            '--tw-prose-invert-hr': 'var(--vscode-panel-border)',
            '--tw-prose-invert-quotes': 'var(--vscode-foreground)',
            '--tw-prose-invert-quote-borders': 'var(--vscode-textBlockQuote-border)',
            '--tw-prose-invert-captions': 'var(--vscode-descriptionForeground)',
            '--tw-prose-invert-code': 'var(--vscode-textPreformat-foreground)',
            '--tw-prose-invert-pre-code': 'var(--vscode-editor-foreground)',
            '--tw-prose-invert-pre-bg': 'var(--vscode-textBlockQuote-background)',
            '--tw-prose-invert-th-borders': 'var(--vscode-panel-border)',
            '--tw-prose-invert-td-borders': 'var(--vscode-panel-border)',
          },
        },
      }),
    },
  },
  plugins: [typography],
}
