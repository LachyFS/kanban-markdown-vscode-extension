# Contributing to Kanban Markdown

Thanks for your interest in contributing to Kanban Markdown! This guide will help you get started.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [VS Code](https://code.visualstudio.com/) (v1.85.0+)
- pnpm

### Setup

1. Fork and clone the repository:

   ```sh
   git clone https://github.com/<your-username>/kanban-markdown-vscode-extension.git
   cd kanban-markdown-vscode-extension
   ```

2. Install dependencies:

   ```sh
   pnpm install
   ```

3. Start the development watcher:

   ```sh
   pnpm dev
   ```

4. Press `F5` in VS Code to launch the Extension Development Host.

## Project Structure

```
src/
├── extension/       # VS Code extension backend (Node.js)
│   ├── index.ts     # Extension entry point
│   └── ...
├── shared/          # Types shared between extension and webview
│   └── types.ts
└── webview/         # React frontend (Vite + Tailwind)
    ├── App.tsx
    ├── components/
    ├── store/
    └── ...
```

- **Extension** is bundled with esbuild (`pnpm run build:extension`)
- **Webview** is bundled with Vite (`pnpm run build:webview`)

## Development

### Available Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Watch mode for both extension and webview |
| `pnpm build` | Production build |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm package` | Package the extension as a `.vsix` |

### Code Style

- **Prettier** is configured — single quotes, no semicolons, 100 char line width
- **2-space indentation**, UTF-8, LF line endings
- Run `pnpm lint` before submitting a PR

## Submitting Changes

1. Create a branch from `main`:

   ```sh
   git checkout -b my-feature
   ```

2. Make your changes and verify they work:

   ```sh
   pnpm lint
   pnpm typecheck
   pnpm build
   ```

3. Commit your changes with a clear message:

   ```
   feat: add drag-and-drop reordering within columns
   fix: prevent duplicate feature IDs on rapid creation
   ```

   We loosely follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `docs:`, etc.).

4. Push your branch and open a pull request against `main`.

## Reporting Bugs

Open an issue at [GitHub Issues](https://github.com/LachyFS/kanban-markdown-vscode-extension/issues) with:

- Steps to reproduce
- Expected vs actual behavior
- VS Code version and OS

## Feature Requests

Feature requests are welcome! Please open an issue describing the use case and proposed behavior.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
