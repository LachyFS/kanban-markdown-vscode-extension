# Changelog

All notable changes to the Kanban Markdown extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.6] - 2026-02-09

### Added
- Live settings updates: webview now instantly reflects VS Code setting changes without reopening
- Configuration change listener for KanbanPanel (columns, display settings, defaults)
- Configuration change listener for FeatureHeaderProvider (features directory re-evaluation)

### Fixed
- File watcher now properly disposes when features directory setting changes

## [0.1.5] - 2026-02-09

### Fixed
- VS Code configuration settings (columns, priority badges, assignee, due date, compact mode, default priority/status) now correctly propagate to the webview
- Quick add input uses configured default priority instead of hardcoded value
- Create feature dialog uses configured default priority and status

### Changed
- Removed obsolete macOS entitlements and icon files from the build directory

## [0.1.4] - 2026-01-29

### Added
- Pressing `enter` in the title input field moves cursor to the description textarea, `shift-enter` creates a new line

### Fixed
- Prevent opening new feature panel when editing an existing feature with `n` hotkey
- Use `resourceLangId` instead of hardcoded path for kanban-markdown command
- Remove hardcoded devtool resource path for `editor/title/run` menu item
- Removed redundant tile heading in edit view UI, (title is already visible in markdown editor)

## [0.1.1] - 2026-01-28

### Added
- AI agent integration for starting feature creation with Claude, Codex, or OpenCode
- Keyboard shortcuts for AI actions
- Configurable kanban columns with custom colors
- Priority badges, assignee, and due date display options
- Compact mode setting for feature cards
- Marketplace publishing support (VS Code + Open VSX)

### Changed
- Updated repository URLs to reflect new ownership
- Replaced SVG icons with PNG formats for better compatibility
- Enhanced README with installation instructions and images

## [0.1.0] - 2026-01-27

### Added
- Initial release
- Kanban board view for managing features as markdown files
- Drag-and-drop between columns (Backlog, To Do, In Progress, Review, Done)
- Feature cards with frontmatter metadata (status, priority, assignee, due date)
- Create, edit, and delete features from the board
- Configurable features directory
- Rich markdown editor with Tiptap
- VS Code webview integration
