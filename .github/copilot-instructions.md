# Gemini CLI Notion Extension - AI Agent Instructions

## Project Overview

This is a **Gemini CLI extension** providing full Notion workspace integration via the Model Context Protocol (MCP). It enables Gemini to manage pages, databases, blocks, comments, and search through Notion tools.

## Voice Transcription Input

**CRITICAL:** User input often comes from voice transcription services. Expect:
- Misspellings and phonetic errors ("no shun" → "Notion", "data base" → "database")
- Missing punctuation and spacing
- Incomplete sentences

**Always interpret intent contextually. Ask for clarification when truly ambiguous.**

## Architecture

```
├── src/
│   ├── server.ts           # MCP server entry point - handles tool routing
│   ├── notion-client.ts    # Wrapper for @notionhq/client SDK
│   └── tools.ts            # Tool definitions with JSON schemas
├── commands/               # Slash command definitions (.toml)
├── GEMINI.md               # AI context for Gemini CLI
├── gemini-extension.json   # Extension manifest
└── .env                    # API token (git-ignored, NEVER commit)
```

## Key Patterns

### API Token Security
- Integration token stored in `.env` file (git-ignored)
- Loaded via `dotenv` at server startup
- Passed through `gemini-extension.json` env config
- **NEVER commit tokens or expose in logs**

### Notion Client (`src/notion-client.ts`)
- Uses official `@notionhq/client` SDK
- Initialized with auth token from environment
- All methods are async and throw on API errors
- Returns typed responses from Notion API

### Tool Definitions (`src/tools.ts`)
- JSON Schema format for MCP protocol
- Tools organized by category: pages, databases, blocks, search, comments
- Each tool has name, description, and inputSchema
- Support for Notion's block types and property types

### Server (`src/server.ts`)
- Uses `@modelcontextprotocol/sdk` for MCP protocol
- StdioServerTransport for Gemini CLI communication
- Switch-case routing for tool execution
- Returns JSON results or error messages

## Notion Quirks & Concepts

### Page IDs & Database IDs
- UUIDs with hyphens: `12345678-1234-1234-1234-123456789abc`
- Also accepted without hyphens (SDK normalizes)
- Page IDs and Database IDs use same format

### Block Types
Common blocks to support:
- `paragraph`, `heading_1`, `heading_2`, `heading_3`
- `bulleted_list_item`, `numbered_list_item`
- `to_do`, `toggle`, `code`
- `callout`, `quote`, `divider`

### Database Properties
Key property types:
- `title`: Main property (required, exactly one per database)
- `rich_text`: Plain or formatted text
- `number`, `checkbox`, `select`, `multi_select`
- `date`: Start/end dates with optional time
- `relation`: Links to other database entries
- `formula`, `rollup`: Computed properties

### Rich Text Format
```typescript
{
  type: "text",
  text: { content: "Hello world" },
  annotations: { bold: false, italic: false, ... }
}
```

## Development Workflow

```bash
# Install dependencies
npm install

# Development (with hot reload)
npm run dev

# Build for production
npm run build

# Link extension locally for testing
gemini extensions link .
```

## Common Tasks

### Adding a New Tool
1. Add tool definition to `src/tools.ts`
2. Add handler case in `src/server.ts` switch statement
3. If new API operation, add method to `src/notion-client.ts`
4. Update `GEMINI.md` with usage examples

### Working with Blocks
- Blocks are nested: use `children` array for hierarchy
- Appending blocks requires parent page/block ID
- Updating blocks requires block ID (not page ID)
- Max 100 blocks per request

### Querying Databases
- Use `database.query()` for filtered results
- Filters use Notion's filter syntax (AND/OR/property conditions)
- Sorts by property name and direction
- Pagination via `start_cursor` and `page_size`

### Testing Changes
```bash
npm run build
gemini  # Start Gemini CLI with extension loaded
```

## Error Handling

- SDK throws `APIResponseError` with status code and message
- Common errors: 401 (bad token), 404 (not found), 400 (validation error)
- Server wraps errors and returns `isError: true` in MCP response
- Permission errors: 403 (check integration capabilities in Notion)

## Dependencies

- `@notionhq/client`: Official Notion JavaScript SDK
- `@modelcontextprotocol/sdk`: MCP server implementation
- `dotenv`: Environment variable loading
- `typescript`, `tsx`, `@types/node`: Development tooling

## File Locations

| Purpose | File |
|---------|------|
| API token | `.env` (create from `.env.example`) |
| Extension manifest | `gemini-extension.json` |
| AI context | `GEMINI.md` |
| Slash commands | `commands/*.toml` |
| Build output | `dist/` |

## Integration Setup

1. Create Notion integration at https://www.notion.so/my-integrations
2. Copy "Internal Integration Token"
3. Add to `.env` as `NOTION_TOKEN=secret_xxx`
4. Share relevant Notion pages/databases with the integration
5. Test with `gemini extensions list`
