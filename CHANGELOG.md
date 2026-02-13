# Changelog

All notable changes to the Kanban Markdown extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-02-13

### Added
- `completedAt` frontmatter field that records when a feature was marked as done, displayed as relative time on cards (e.g. "completed 2 days ago")

### Changed
- Simplified status subfolders to use only a `done` folder instead of per-status folders

### Dependencies
- Bumped `qs` from 6.14.1 to 6.14.2

## [1.1.0] - 2026-02-13

### Added
- Open file button in editor to quickly jump to the underlying markdown file ([#19](https://github.com/LachyFS/kanban-markdown-vscode-extension/issues/19))
- External change detection in editor — reloads content when the file is modified outside the extension ([#19](https://github.com/LachyFS/kanban-markdown-vscode-extension/issues/19))

### Fixed
- CRLF line endings no longer break markdown frontmatter parsing ([#20](https://github.com/LachyFS/kanban-markdown-vscode-extension/issues/20))
- Order collisions when deleting features in KanbanPanel ([0f11a00](https://github.com/LachyFS/kanban-markdown-vscode-extension/commit/0f11a00))

### Changed
- Removed delete button from feature cards for a cleaner card layout ([086e738](https://github.com/LachyFS/kanban-markdown-vscode-extension/commit/086e738))

### Thanks
- [@hodanli](https://github.com/hodanli) for requesting the open file button and external change detection ([#19](https://github.com/LachyFS/kanban-markdown-vscode-extension/issues/19)), and reporting the CRLF line ending bug ([#20](https://github.com/LachyFS/kanban-markdown-vscode-extension/issues/20))

## [1.0.0] - 2026-02-12

### Added
- Sidebar view for Kanban board in the activity bar ([#9](https://github.com/LachyFS/kanban-markdown-vscode-extension/issues/9))
- Drag-and-drop card reordering within columns ([#16](https://github.com/LachyFS/kanban-markdown-vscode-extension/issues/16))
- Label management with suggestions in CreateFeatureDialog and FeatureEditor ([#4](https://github.com/LachyFS/kanban-markdown-vscode-extension/issues/4))
- `showLabels` setting to toggle label visibility on cards and in editors
- Assignee input with suggestions in feature creation and editing
- Due date and label fields in feature creation dialog
- "Build with AI" feature toggle (`showBuildWithAI` setting) that respects `disableAIFeatures` ([#5](https://github.com/LachyFS/kanban-markdown-vscode-extension/issues/5))
- Status subfolders support with automatic migration of existing feature files ([#3](https://github.com/LachyFS/kanban-markdown-vscode-extension/issues/3))
- Auto-save functionality in FeatureEditor

### Fixed
- Broken label selector in edit view
- `n` hotkey no longer triggers when modifier keys are held ([#7](https://github.com/LachyFS/kanban-markdown-vscode-extension/issues/7))
- Alt key no longer blocked from opening the menu bar ([#8](https://github.com/LachyFS/kanban-markdown-vscode-extension/issues/8))
- Missing activation event for sidebar webview ([#14](https://github.com/LachyFS/kanban-markdown-vscode-extension/issues/14))
- Date selection no longer rendered off-screen ([#10](https://github.com/LachyFS/kanban-markdown-vscode-extension/issues/10))
- Input handling now correctly ignores contentEditable elements
- Due date hidden on cards with "done" status ([#17](https://github.com/LachyFS/kanban-markdown-vscode-extension/issues/17))

### Changed
- Removed QuickAdd functionality in favor of the full CreateFeatureDialog
- Consistent card height across all columns
- Replaced `Buffer` with `TextEncoder` for file writing (browser compatibility)
- Replaced Node `fs` module with `vscode.workspace.fs` for file operations (virtual filesystem support)

### Thanks
- [@ungive](https://github.com/ungive) for requesting the sidebar view ([#9](https://github.com/LachyFS/kanban-markdown-vscode-extension/issues/9)) and card reordering ([#16](https://github.com/LachyFS/kanban-markdown-vscode-extension/issues/16)), and reporting numerous bugs around hotkeys ([#7](https://github.com/LachyFS/kanban-markdown-vscode-extension/issues/7)), activation ([#14](https://github.com/LachyFS/kanban-markdown-vscode-extension/issues/14)), date rendering ([#10](https://github.com/LachyFS/kanban-markdown-vscode-extension/issues/10), [#17](https://github.com/LachyFS/kanban-markdown-vscode-extension/issues/17)), and the menu bar ([#8](https://github.com/LachyFS/kanban-markdown-vscode-extension/issues/8))
- [@hodanli](https://github.com/hodanli) for requesting label management from the UI ([#4](https://github.com/LachyFS/kanban-markdown-vscode-extension/issues/4)) and status subfolders for done items ([#3](https://github.com/LachyFS/kanban-markdown-vscode-extension/issues/3))

## [0.1.6] - 2026-02-09

### Added
- Live settings updates: webview now instantly reflects VS Code setting changes without reopening
- Configuration change listener for KanbanPanel (columns, display settings, defaults)
- Configuration change listener for FeatureHeaderProvider (features directory re-evaluation)

### Fixed
- File watcher now properly disposes when features directory setting changes

## [0.1.5] - 2026-02-09

### Fixed
- VS Code configuration settings (columns, priority badges, assignee, due date, compact mode, default priority/status) now correctly propagate to the webview ([#2](https://github.com/LachyFS/kanban-markdown-vscode-extension/issues/2))
- Quick add input uses configured default priority instead of hardcoded value
- Create feature dialog uses configured default priority and status

### Changed
- Removed obsolete macOS entitlements and icon files from the build directory

### Thanks
- [@hodanli](https://github.com/hodanli) for reporting the priority badges settings bug ([#2](https://github.com/LachyFS/kanban-markdown-vscode-extension/issues/2))

## [0.1.4] - 2026-01-29

### Added
- Pressing `enter` in the title input field moves cursor to the description textarea, `shift-enter` creates a new line

### Fixed
- Prevent opening new feature panel when editing an existing feature with `n` hotkey
- Use `resourceLangId` instead of hardcoded path for kanban-markdown command ([#1](https://github.com/LachyFS/kanban-markdown-vscode-extension/issues/1))
- Remove hardcoded devtool resource path for `editor/title/run` menu item ([#1](https://github.com/LachyFS/kanban-markdown-vscode-extension/issues/1))
- Removed redundant tile heading in edit view UI, (title is already visible in markdown editor)

### Thanks
- [@SuperbDotHub](https://github.com/SuperbDotHub) for reporting the features directory path bug ([#1](https://github.com/LachyFS/kanban-markdown-vscode-extension/issues/1))

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
