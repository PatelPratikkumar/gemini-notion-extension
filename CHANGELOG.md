# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.8.0] - 2025-12-14

### Added
- **TTL-Based Caching Layer**: Intelligent caching for schemas (10min), lists (2min), pages (1min), users (30min)
- **Enhanced Logging System**: Structured logging with levels (debug, info, warn, error) and log retrieval
- **Metrics Collection**: Track API call counts, latency, error rates per operation
- **Offline Queue**: Queue operations when offline, process when back online
- **Template System**: 5 built-in templates (meeting-notes, project-brief, daily-standup, bug-report, code-review)
- **Schema Validation**: Validate properties against database schema before API calls
- **Health Check Tool**: Monitor Notion API connectivity, cache status, queue size
- **Batch Operations**: 
  - `batch_create_pages`: Create multiple pages at once
  - `batch_archive_pages`: Archive multiple pages at once
  - `batch_delete_blocks`: Delete multiple blocks at once
- **Enhanced Page Duplication**: Full content copy with proper block cloning

### New Tools (12 added, 38 total)
- `health_check` - System health and API connectivity
- `get_metrics` - API call statistics and performance
- `get_logs` - Retrieve operation logs for debugging
- `clear_cache` - Clear cached data (schemas, lists, pages, users, all)
- `list_templates` - Show available page templates
- `create_from_template` - Create page from template
- `batch_create_pages` - Create multiple pages
- `batch_archive_pages` - Archive multiple pages
- `batch_delete_blocks` - Delete multiple blocks
- `validate_properties` - Validate against database schema
- `get_queue_status` - Offline queue status
- `clear_queue` - Clear offline queue

### Changed
- Bundle size increased to ~670KB (additional features)
- `duplicate_page` now uses enhanced duplication with full content copy

## [2.7.0] - 2025-12-14

### Added
- **Rate Limiting**: Token Bucket algorithm limiting to 3 requests/second
- **Retry Logic**: Exponential backoff for 429 (rate limit) and 5xx (server) errors
- **Auto-Pagination**: `paginateQuery()` for database queries returning >100 items
- **Block Pagination**: `paginateBlockChildren()` for pages with >100 blocks
- **Content Chunking**: `chunkContent()` splits content at 50KB boundaries
- **Block Chunking**: `createChunkedBlocks()` creates multiple blocks from large content
- **Batch Appending**: `appendBlocksInBatches()` handles >100 blocks per request
- Network error handling (ECONNRESET, ETIMEDOUT, ENOTFOUND)

### Changed
- `query_database` now auto-paginates when limit > 100
- `get_page` now uses pagination for block content
- `append_blocks` now uses chunking for >50KB content and batching for >100 blocks
- All major API calls wrapped with retry logic

### Security
- Removed `.github/` folder from repository (contained private instructions)
- Added `.github/` and `research/` to `.gitignore`

## [2.5.0] - 2025-12-14

### Added
- `contextFiles` declaration in gemini-extension.json
- Extension capabilities (streaming, 10MB max)
- Metadata (category, tags)
- New commands: `search-notion`, `recent-changes`
- Decision tree for tool selection in GEMINI.md
- Step-by-step workflows for common tasks
- Performance optimization section
- Error handling reference table
- Quick reference section

### Changed
- GEMINI.md restructured as "Notion Extension Playbook v2.3"
- Improved "DO NOT ASK QUESTIONS" behavior rules

## [2.3.0] - 2025-12-14

### Added
- esbuild bundling for standalone installation (~640KB bundle)
- Proper MCP server configuration (object format, not array)

### Fixed
- Extension naming changed to "notion-extension"
- MCP server key set to "notion"
- Timestamp sorting (use `timestamp` not `property`)

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

### [2.9.0] - Planned
- [ ] Webhook support for real-time updates
- [ ] Connection pooling for better performance
- [ ] gzip compression for large payloads
- [ ] Progress streaming for long operations
- [ ] Custom template creation and management

### [3.0.0] - Future
- [ ] Two-way sync between local files and Notion
- [ ] Integration with other Gemini extensions
- [ ] Custom block type support
- [ ] Advanced filtering with natural language
- [ ] Real-time collaboration features
- [ ] Plugin system for custom tools
