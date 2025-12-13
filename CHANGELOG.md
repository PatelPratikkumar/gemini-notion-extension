# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2025-12-14

### Added
- Direct GitHub installation support
- Comprehensive troubleshooting section in README
- "Made with ❤️" footer matching Todoist extension style

### Changed
- README restructured to match Todoist extension format
- Cleaner .gitignore without exposing private folder names
- Better badge styling and documentation

### Fixed
- Install command format (full URL, not github:user/repo)
- Repository URLs updated to correct GitHub username

## [2.0.0] - 2025-12-14

### Added
- 25 comprehensive Notion tools covering all API capabilities
- Cross-platform secure credential storage (Windows, macOS, Linux)
- Markdown to Notion blocks converter
- Full-text search across workspace
- Comment support (read and add)
- User listing and current user info
- Project management tools (create, update, list)
- Conversation export with automatic formatting
- Database shortcuts (`"projects"`, `"conversations"`)
- Comprehensive setup scripts for all platforms
- Detailed README with troubleshooting guide
- GEMINI.md playbook with usage examples

### Changed
- Complete rewrite of MCP server for better performance
- Simplified credential management
- Improved error messages and handling
- Better database discovery and auto-selection

### Fixed
- Cache file path resolution when running from different directories
- TypeScript compilation issues with Notion SDK types
- Comment API compatibility

## [1.0.0] - 2025-12-13

### Added
- Initial release
- Basic page creation and reading
- Database query functionality
- Conversation export to Notion
- Project tracking support
- Windows setup script
- Basic documentation

---

## Roadmap

### [2.1.0] - Planned
- [ ] Batch operations for multiple pages
- [ ] Template support for common page structures
- [ ] Webhook support for real-time updates
- [ ] Offline caching for faster queries

### [3.0.0] - Future
- [ ] Two-way sync between local files and Notion
- [ ] Integration with other Gemini extensions
- [ ] Custom block type support
- [ ] Advanced filtering with natural language
