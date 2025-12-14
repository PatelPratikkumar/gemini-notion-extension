# 📝 Gemini CLI Notion Extension

> Full Notion workspace integration for [Gemini CLI](https://github.com/google-gemini/gemini-cli) via Model Context Protocol (MCP).

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![Gemini CLI](https://img.shields.io/badge/Gemini%20CLI-Extension-blue.svg)](https://github.com/google-gemini/gemini-cli)

Manage your entire Notion workspace directly from the command line with natural language.

## ✨ Features

- **25 MCP Tools** covering all Notion operations
- **Natural Language** - "Create a page about project planning"
- **Markdown Support** - Write in markdown, converts to Notion blocks
- **Smart Formatting** - Clean, readable output (no raw JSON!)
- **Database Shortcuts** - Use "projects" or "conversations" as aliases
- **Voice-Friendly** - Handles transcription errors gracefully
- **Secure Storage** - API keys stored in OS credential manager

### Supported Operations

| Category | Operations |
|----------|------------|
| **Search** | Full-text search across workspace |
| **Pages** | Create, read, update, delete |
| **Databases** | Query, create entries, get/update schema |
| **Blocks** | Append, get children, delete |
| **Comments** | List, create |
| **Users** | List all, get current user |
| **Projects** | List, create, update status |
| **Conversations** | Export Gemini chats to Notion |

---

## 📋 Prerequisites

Before installing, you need:

1. **Node.js 18+** - [Download here](https://nodejs.org/)
2. **Gemini CLI** - Install globally:
   ```bash
   npm install -g @google/gemini-cli
   ```
3. **Notion Integration Token** - Get yours below 👇

---

## 🔐 Getting Your Notion API Token

1. Log in to [Notion](https://www.notion.so)
2. Go to [My Integrations](https://www.notion.so/my-integrations)
3. Click **"+ New integration"**
4. Configure:
   - **Name**: `Gemini CLI Extension`
   - **Associated workspace**: Select your workspace
   - **Capabilities**: Check all Content, Comment, and User capabilities
5. Click **"Submit"**
6. Copy the **Internal Integration Token** (starts with `secret_`)

> ⚠️ **Keep your token secret!** Never share it or commit it to git.

---

## 🚀 Quick Start

### Option A: Install from GitHub (Recommended)

```bash
gemini extensions install https://github.com/PatelPratikkumar/gemini-notion-extension
```

Then run the setup script from the extension directory:
```bash
# Windows
cd ~/.gemini/extensions/notion-extension
.\setup-windows.ps1

# macOS/Linux  
cd ~/.gemini/extensions/notion-extension
chmod +x setup-unix.sh && ./setup-unix.sh
```

### Option B: Clone and Build Manually

#### 1. Clone the Repository

```bash
git clone https://github.com/PatelPratikkumar/gemini-notion-extension.git
cd gemini-notion-extension
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create Notion Integration

1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Click **"+ New integration"**
3. Configure:
   - **Name**: `Gemini CLI Extension`
   - **Associated workspace**: Select your workspace
   - **Capabilities**: Check all Content, Comment, and User capabilities
4. Click **"Submit"**
5. Copy the **Internal Integration Token** (starts with `secret_`)

### 4. Share Pages with Integration

In Notion, share the pages/databases you want to access:
1. Open a page or database
2. Click **"Share"** (top right)
3. Click **"Add connections"** or **"Invite"**
4. Select **"Gemini CLI Extension"**

### 5. Run Setup Script

<details>
<summary><strong>🪟 Windows (PowerShell)</strong></summary>

```powershell
.\setup-windows.ps1
```

The script will:
1. Prompt for your Notion token (hidden input)
2. Test the connection
3. Show all accessible databases
4. Let you select Project and Conversation databases
5. Create Conversation database if needed
6. Save configuration securely

**Where is my token stored?**
- User environment variable: `NOTION_API_KEY`
- Database IDs: `.notion-cache.json` (local file)

</details>

<details>
<summary><strong>🍎 macOS</strong></summary>

```bash
chmod +x setup-unix.sh
./setup-unix.sh
```

The script will:
1. Prompt for your Notion token
2. Test the connection
3. Store token in **macOS Keychain** (secure)
4. Configure databases automatically

**Where is my token stored?**
- macOS Keychain: `gemini-notion-extension` service
- Retrieve manually: `security find-generic-password -s "gemini-notion-extension" -a "NOTION_API_KEY" -w`

</details>

<details>
<summary><strong>🐧 Linux</strong></summary>

```bash
chmod +x setup-unix.sh
./setup-unix.sh
```

**Prerequisites:**
- `secret-tool` (libsecret): `sudo apt install libsecret-tools` (Debian/Ubuntu)
- GNOME Keyring or KDE Wallet running

The script will:
1. Prompt for your Notion token
2. Test the connection  
3. Store token in **GNOME Keyring/libsecret** (secure)
4. Configure databases automatically

**Where is my token stored?**
- libsecret: `gemini-notion-extension` service
- Retrieve manually: `secret-tool lookup service gemini-notion-extension account NOTION_API_KEY`

</details>

### 6. Build the Extension

```bash
npm run build
```

### 7. Link to Gemini CLI

```bash
gemini extensions link .
```

### 8. Start Using!

```bash
gemini
```

Then try commands like:
```
List my databases
Show active projects
Search for pages about API
Export this conversation
```

---

## 🛠️ Available Tools (25)

### Search
| Tool | Description |
|------|-------------|
| `notion_search` | Search pages and databases by name or content |

### Pages
| Tool | Description |
|------|-------------|
| `create_page` | Create new pages with markdown content |
| `get_page` | Retrieve page properties and content |
| `update_page` | Modify title, icon, cover, properties |
| `delete_page` | Archive (soft delete) pages |

### Databases
| Tool | Description |
|------|-------------|
| `list_databases` | List all accessible databases |
| `query_database` | Filter and sort database entries |
| `create_database` | Create new databases with schema |
| `add_database_entry` | Add rows to databases |
| `get_database_schema` | View database columns/properties |

### Blocks (Content)
| Tool | Description |
|------|-------------|
| `get_block_children` | Read page content as blocks |
| `append_blocks` | Add content (markdown supported) |
| `update_block` | Modify existing blocks |
| `delete_block` | Remove blocks |

### Comments
| Tool | Description |
|------|-------------|
| `get_comments` | Read page comments |
| `add_comment` | Add comments to pages |

### Users
| Tool | Description |
|------|-------------|
| `list_users` | List workspace members |
| `get_current_user` | Get integration info |

### Projects
| Tool | Description |
|------|-------------|
| `list_projects` | List from project database |
| `create_project` | Create new projects |
| `update_project` | Modify project details |

### Conversations
| Tool | Description |
|------|-------------|
| `export_conversation` | Save chat to Notion |
| `link_conversation_to_project` | Connect conversation to project |

### Utility
| Tool | Description |
|------|-------------|
| `duplicate_page` | Copy pages |
| `get_recent_changes` | See recently modified items |

---

## 📖 Usage Examples

### Export a Conversation
```
Export this conversation with title "API Design Discussion" and tags: api, architecture
```

### Query Database
```
Show all projects where status is Active, sorted by start date
```

### Create Content
```
Create a page called "Meeting Notes" with content:
# Summary
- Discussed roadmap
- Approved budget

## Action Items
- [ ] Send proposal
- [ ] Review designs
```

### Search Workspace
```
Search for all pages mentioning "authentication"
```

---

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NOTION_API_KEY` | Notion integration token | Yes |

### Cache File (`.notion-cache.json`)

```json
{
  "conversationDbId": "uuid-of-conversation-database",
  "projectDbId": "uuid-of-project-database",
  "lastUpdated": "2025-01-01T00:00:00.000Z"
}
```

### Gemini Extension Config (`gemini-extension.json`)

```json
{
  "name": "notion-extension",
  "description": "Full Notion workspace integration",
  "mcpServers": {
    "notion": {
      "command": "node",
      "args": ["dist/bundle.js"],
      "timeout": 30
    }
  }
}
```

---

## 🔐 Security

- **No tokens in code**: API keys stored in OS credential managers
- **No tokens in git**: `.gitignore` excludes all sensitive files
- **Environment variable fallback**: Works if credential manager unavailable
- **Local cache only**: Database IDs stored locally, not synced

### Token Storage Locations

| Platform | Storage | Security |
|----------|---------|----------|
| Windows | User environment variable | Process-isolated |
| macOS | Keychain | Encrypted, requires unlock |
| Linux | libsecret/GNOME Keyring | Encrypted, session-based |

---

## 🐛 Troubleshooting

### "Connection failed" or "ECONNRESET"

1. Verify your token: Run setup script again
2. Check Notion status: [status.notion.so](https://status.notion.so)
3. Verify page sharing: Ensure pages are shared with integration

### "Tool not found in registry"

1. Run from project directory: `cd /path/to/extension && gemini`
2. Rebuild: `npm run build`
3. Re-link: `gemini extensions link .`

### "Database IDs not configured"

1. Run setup script: `.\setup-windows.ps1` or `./setup-unix.sh`
2. Verify `.notion-cache.json` exists
3. Check you selected databases during setup

### "API key not found"

**Windows:**
```powershell
# Check if set
$env:NOTION_API_KEY

# Set manually
[System.Environment]::SetEnvironmentVariable("NOTION_API_KEY", "secret_xxx", "User")
```

**macOS:**
```bash
# Check keychain
security find-generic-password -s "gemini-notion-extension" -a "NOTION_API_KEY" -w

# Add manually
security add-generic-password -s "gemini-notion-extension" -a "NOTION_API_KEY" -w "secret_xxx"
```

**Linux:**
```bash
# Check secret
secret-tool lookup service gemini-notion-extension account NOTION_API_KEY

# Store manually
echo "secret_xxx" | secret-tool store --label="Notion API Key" service gemini-notion-extension account NOTION_API_KEY
```

---

## 📁 Project Structure

```
gemini-notion-extension/
├── src/
│   ├── server.ts          # MCP server with all tool handlers
│   ├── tools.ts            # Tool definitions (JSON Schema)
│   ├── credentials.ts      # Cross-platform credential retrieval
│   ├── notion-client.ts    # Notion API wrapper
│   ├── types/              # TypeScript interfaces
│   └── managers/           # Business logic managers
├── dist/                   # Compiled JavaScript (generated)
├── setup-windows.ps1       # Windows setup script
├── setup-unix.sh          # macOS/Linux setup script
├── gemini-extension.json   # Gemini CLI manifest
├── GEMINI.md              # AI playbook
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🔄 Changelog

### v2.8.0 (2025-12-14) ⭐ LATEST
- 💾 **TTL Caching**: Smart caching for schemas, lists, pages, users
- 📊 **Metrics**: Track API calls, latency, error rates
- 📝 **Logging**: Structured logs with levels (debug/info/warn/error)
- 📴 **Offline Queue**: Queue operations when disconnected
- 📑 **5 Templates**: meeting-notes, project-brief, daily-standup, bug-report, code-review
- ✅ **Schema Validation**: Validate before API calls
- 🏥 **Health Check**: Monitor system status
- 📦 **Batch Ops**: Create/archive pages, delete blocks in bulk
- 🔢 **38 Total Tools** (12 new advanced tools)

### v2.7.0 (2025-12-14)
- ⚡ **Rate Limiting**: Token Bucket algorithm (3 requests/second)
- 🔄 **Retry Logic**: Exponential backoff for 429/5xx errors
- 📄 **Auto-Pagination**: Handle >100 database items automatically
- 📦 **Block Pagination**: Handle >100 blocks per page
- ✂️ **Content Chunking**: Split >50KB content automatically
- 🔀 **Batch Appending**: Handle >100 blocks per request
- 🌐 Network error handling (ECONNRESET, ETIMEDOUT)

### v2.5.0 (2025-12-14)
- 📋 Decision tree for tool selection
- 📝 Step-by-step workflows in GEMINI.md
- 🔧 contextFiles declaration for AI guidance
- 🚀 New commands: `search-notion`, `recent-changes`

### v2.3.0 (2025-12-14)
- 📦 esbuild bundling for standalone installation (~640KB)
- 🔧 Proper MCP server configuration

### v2.1.0 (2025-12-14)
- 🔗 Direct GitHub installation support
- 📚 Comprehensive troubleshooting section

### v2.0.0 (2025-12-14)
- ✨ 25 comprehensive Notion tools
- 🔐 Cross-platform secure credential storage
- 📝 Markdown to Notion blocks conversion
- 🔍 Full-text search across workspace
- 💬 Comment support
- 👥 User listing
- 📁 Project management
- 💾 Conversation export
- 🛠️ Database shortcuts (`"projects"`, `"conversations"`)

### v1.0.0 (2025-12-13)
- 🎉 Initial release
- Basic page and database operations
- Conversation export

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file.

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

---

## 🙏 Acknowledgments

- [Gemini CLI](https://github.com/google-gemini/gemini-cli) by Google
- [Notion API](https://developers.notion.com/) by Notion
- [Model Context Protocol](https://modelcontextprotocol.io/) for MCP server framework

---

## ❓ Troubleshooting

### "NOTION_API_KEY not set"

Make sure you've run the setup script or set the credential manually:
- Windows: `echo $env:NOTION_API_KEY`
- macOS: `security find-generic-password -s "gemini-notion-extension" -a "NOTION_API_KEY" -w`
- Linux: `secret-tool lookup service gemini-notion-extension account NOTION_API_KEY`

### "Extension not loading"

1. Rebuild: `npm run build`
2. Relink: `gemini extensions uninstall notion-extension && gemini extensions link .`

### "API errors" or "object not found"

- Verify your integration is shared with the page/database in Notion
- Check your token at [Notion Integrations](https://www.notion.so/my-integrations)
- Ensure token has correct capabilities (Content, Comments, User)

### "Page not accessible"

1. Open the page in Notion
2. Click **Share** → **Add connections**
3. Select your **Gemini CLI Extension** integration

---

**Made with ❤️ for productivity enthusiasts**
