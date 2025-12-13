# Gemini CLI Notion Extension

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/PatelPratikkumar/gemini-notion-extension)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)

Full-featured Notion integration for [Gemini CLI](https://github.com/google-gemini/gemini-cli). Manage your entire Notion workspace directly from the command line.

## ✨ Features

- 🔍 **Search** - Find pages and databases across your workspace
- 📄 **Pages** - Create, read, update, and delete pages
- 🗃️ **Databases** - Query, create entries, and manage schemas
- 📝 **Blocks** - Add and modify content with markdown support
- 💬 **Comments** - Read and add comments to pages
- 👥 **Users** - List workspace members
- 📁 **Projects** - Track projects with status and technologies
- 💾 **Conversations** - Export Gemini chats to Notion
- 🔐 **Secure** - API keys stored in OS credential manager

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) v18.0.0 or higher
- [Gemini CLI](https://github.com/google-gemini/gemini-cli) installed
- [Notion account](https://www.notion.so/) with integration access

## 🚀 Quick Start

### Option A: Install from GitHub (Recommended)

```bash
gemini extensions install https://github.com/PatelPratikkumar/gemini-notion-extension
```

Then run the setup script from the extension directory:
```bash
# Windows
cd ~/.gemini/extensions/notion-sync
.\setup-windows.ps1

# macOS/Linux  
cd ~/.gemini/extensions/notion-sync
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
  "name": "notion-sync",
  "description": "Full Notion workspace integration",
  "mcp_servers": [{
    "name": "0",
    "type": "local",
    "command": "node",
    "args": ["./dist/server.js"]
  }]
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
