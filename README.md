# 📝 Gemini CLI Notion Extension v3.0 Enhanced Edition

> Complete Notion workspace automation with [Gemini CLI](https://github.com/google-gemini/gemini-cli) via Model Context Protocol (MCP).

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![Gemini CLI](https://img.shields.io/badge/Gemini%20CLI-Extension-blue.svg)](https://github.com/google-gemini/gemini-cli)
[![Version](https://img.shields.io/badge/Version-3.0.0-brightgreen.svg)](https://github.com/PatelPratikkumar/gemini-notion-extension/releases)

Transform your Notion workspace into a powerful automation hub with 46 comprehensive tools, file processing, database templates, and intelligent monitoring.

## ✨ v3.0 Enhanced Features

- **🚀 46 MCP Tools** (38 core + 8 enhanced) covering all Notion operations
- **📄 File Processing** - Bulk upload, automated scanning, file monitoring
- **🎯 Database Templates** - Pre-configured schemas for common workflows
- **📊 Health Analytics** - API monitoring, usage statistics, performance tracking
- **🤖 Automation Ready** - File watchers, bulk operations, rate limiting
- **🔄 Production Stable** - Built on proven v2.8 foundation with enhanced capabilities
- **📝 Markdown Support** - Advanced content conversion with block chunking
- **🔍 Smart Search** - Enhanced search with analytics and filtering
- **🔐 Secure Storage** - Cross-platform credential management
- **🎙️ Voice-Friendly** - Handles transcription errors gracefully

### New in v3.0: Enhanced Tool Categories

| Category | Tools | Examples |
|----------|-------|----------|
| **🔧 Core Notion** | 38 tools | search, create_page, query_database, comments |
| **📄 File Operations** | 4 tools | upload_file_to_notion, bulk_create_pages_from_files |
| **🎯 Database Templates** | 1 tool | create_database_from_template (4 templates) |
| **📊 Health & Analytics** | 2 tools | check_api_health, get_usage_statistics |
| **🔍 Enhanced Search** | 1 tool | advanced_search (with analytics) |
| **Total** | **46 tools** | Complete workspace automation |

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

## 🛠️ Complete Tool Reference (46 Tools)

### 🔧 Core Notion Operations (38 Tools)

#### Search & Discovery
| Tool | Description | Example Usage |
|------|-------------|---------------|
| `notion_search` | Search pages and databases by name or content | "Search for pages about API design" |
| `advanced_search` | Enhanced search with analytics and filtering | "Find all project docs with analytics" |

#### Page Management  
| Tool | Description | Example Usage |
|------|-------------|---------------|
| `create_page` | Create new pages with markdown content | "Create a meeting notes page" |
| `get_page` | Retrieve page properties and content | "Show me the project overview page" |
| `update_page` | Modify title, icon, cover, properties | "Update the project status" |
| `archive_page` | Archive (soft delete) pages | "Archive completed project pages" |
| `restore_page` | Restore archived pages | "Restore the archived design doc" |
| `duplicate_page` | Copy pages with all content | "Duplicate the template page" |

#### Database Operations
| Tool | Description | Example Usage |
|------|-------------|---------------|
| `list_databases` | List all accessible databases | "Show all my databases" |
| `get_database` | Get database schema and properties | "Show the project database structure" |
| `query_database` | Filter and sort database entries | "Show active projects sorted by date" |
| `create_database` | Create new databases with custom schema | "Create a task tracking database" |
| `update_database` | Modify database properties and schema | "Add a priority field to tasks" |

#### Block & Content Management
| Tool | Description | Example Usage |
|------|-------------|---------------|
| `get_page_blocks` | Read page content as structured blocks | "Get the content of the meeting notes" |
| `append_blocks` | Add content (markdown supported) | "Add action items to the page" |
| `update_block` | Modify existing blocks | "Update the project timeline" |
| `delete_block` | Remove specific blocks | "Remove the old requirements section" |

#### Comments & Collaboration
| Tool | Description | Example Usage |
|------|-------------|---------------|
| `get_comments` | Read all comments on a page | "Show comments on the proposal" |
| `create_comment` | Add comments to pages | "Add feedback to the design doc" |

#### Users & Workspace
| Tool | Description | Example Usage |
|------|-------------|---------------|
| `get_user` | Get current user information | "Show my Notion account info" |
| `list_users` | List all workspace members | "Who has access to this workspace?" |

### 🚀 Enhanced Operations (8 New Tools)

#### 📄 File Processing & Automation
| Tool | Description | Example Usage |
|------|-------------|---------------|
| `upload_file_to_notion` | Upload files with metadata extraction | "Upload the PDF contract to the legal database" |
| `bulk_create_pages_from_files` | Process multiple files into database entries | "Create pages for all PDFs in the contracts folder" |
| `start_file_watcher` | Monitor folders for new files (framework ready) | "Watch the scans folder for new documents" |
| `stop_file_watcher` | Stop file monitoring processes | "Stop watching the downloads folder" |
| `list_active_watchers` | List all active file monitors | "Show all active file watchers" |

#### 🎯 Database Templates
| Tool | Description | Templates Available |
|------|-------------|---------------------|
| `create_database_from_template` | Create databases with pre-configured schemas | **Document Scanner**, Project Tracker, Meeting Notes, Task Management |

**Template Details:**
- **Document Scanner** - Perfect for PDF automation (Name, File Path, Upload Date, Document Type, Status, Notes)
- **Project Tracker** - Complete project management (Name, Status, Description, Dates, Priority)  
- **Meeting Notes** - Structured meetings (Title, Date, Participants, Meeting Type, Action Items)
- **Task Management** - Task tracking (Task, Status, Priority, Assignee, Due Date, Tags)

#### 📊 Health & Analytics
| Tool | Description | Monitoring Features |
|------|-------------|---------------------|
| `check_api_health` | Comprehensive API health monitoring | Connectivity, latency, uptime, error rates |
| `get_usage_statistics` | Detailed API usage analytics | Request counts, performance metrics, feature usage |

---

## 🎯 Enhanced Workflow Examples

### 📄 Document Automation Workflow
```bash
# 1. Create a document scanning database
"Create a document scanner database called 'Legal Documents' in my workspace"

# 2. Bulk process PDF files
"Process all PDF files in my Downloads/Contracts folder and create database entries"

# 3. Start monitoring for new files
"Start watching Downloads/Scans folder for new PDF files"

# 4. Check processing status
"Show me the health status and processing statistics"
```

### 🏢 Project Management Setup
```bash
# 1. Create project database from template
"Create a project tracker database called 'Q1 2025 Projects'"

# 2. Bulk create projects from file list
"Create project entries for all files in my Project-Plans folder"

# 3. Monitor project database
"Show usage statistics for the last 24 hours"

# 4. Health check
"Check API health with detailed metrics"
```

### 📊 Analytics & Monitoring
```bash
# Monitor workspace health
"Check API health with full details"

# Get usage insights
"Show usage statistics for the past week"

# File processing status  
"List all active file watchers and their status"
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

## 🔄 Version History & Changelog

### v3.0.0 (2025-12-14) 🚀 **ENHANCED EDITION**
**Major Release: Complete Automation Platform**

#### 🆕 New Enhanced Features
- **📄 File Processing Suite**: Upload, bulk operations, automated scanning
- **🎯 Database Templates**: 4 pre-built templates (Document Scanner, Project Tracker, Meeting Notes, Task Management)
- **📊 Health Analytics**: API monitoring, usage statistics, performance tracking  
- **🔍 Advanced Search**: Enhanced search with analytics and filtering
- **🤖 Automation Framework**: File watchers, bulk operations (framework ready)

#### 📈 Enhanced Capabilities
- **46 Total Tools** (+21% increase from 38 tools)
- **8 New Enhanced Tools** built on research analysis
- **Production Monitoring** with health checks and statistics
- **Template-Based Workflows** for common automation scenarios
- **File Processing Pipeline** ready for document automation

#### 🔧 Technical Improvements
- Enhanced server architecture with v3.0 naming
- Comprehensive tool categorization and documentation
- Production-ready monitoring and analytics
- Maintained 100% backward compatibility with v2.8

### v2.8.0 (2025-12-14) ⭐ **FOUNDATION RELEASE**
#### 💾 Performance & Reliability
- **TTL Caching**: Smart caching for schemas, lists, pages, users
- **📊 Metrics**: Track API calls, latency, error rates  
- **📝 Logging**: Structured logs with levels (debug/info/warn/error)
- **📴 Offline Queue**: Queue operations when disconnected
- **📑 5 Templates**: meeting-notes, project-brief, daily-standup, bug-report, code-review
- **✅ Schema Validation**: Validate before API calls
- **🏥 Health Check**: Monitor system status  
- **📦 Batch Ops**: Create/archive pages, delete blocks in bulk
- **🔢 38 Total Tools** (12 new advanced tools)

### v2.7.0 (2025-12-14)
#### ⚡ Network & Performance  
- **Rate Limiting**: Token Bucket algorithm (3 requests/second)
- **🔄 Retry Logic**: Exponential backoff for 429/5xx errors
- **📄 Auto-Pagination**: Handle >100 database items automatically
- **📦 Block Pagination**: Handle >100 blocks per page
- **✂️ Content Chunking**: Split >50KB content automatically
- **🔀 Batch Appending**: Handle >100 blocks per request
- **🌐 Network Error Handling**: ECONNRESET, ETIMEDOUT recovery

### v2.5.0 (2025-12-14)
#### 🤖 AI Integration
- **📋 Decision Tree**: Smart tool selection for AI
- **📝 Workflow Guidance**: Step-by-step AI instructions  
- **🔧 Context Files**: Enhanced AI understanding
- **🚀 New Commands**: search-notion, recent-changes

### v2.3.0 (2025-12-14)  
#### 📦 Deployment
- **esbuild Bundling**: Standalone installation (~640KB → 685KB in v3.0)
- **🔧 MCP Configuration**: Proper server setup

### v2.1.0 (2025-12-14)
#### 🔗 Installation  
- **GitHub Direct Install**: One-command installation
- **📚 Troubleshooting**: Comprehensive debugging guide

### v2.0.0 (2025-12-14)
#### ✨ Core Platform
- **25 Comprehensive Tools**: Full Notion API coverage
- **🔐 Secure Credentials**: Cross-platform storage
- **📝 Markdown Conversion**: Rich content support
- **🔍 Full-Text Search**: Workspace-wide search
- **💬 Comments**: Full collaboration support
- **👥 User Management**: Team features
- **📁 Project Tools**: Dedicated project management
- **💾 Conversation Export**: Chat preservation
- **🛠️ Database Shortcuts**: Simplified access

### v1.0.0 (2025-12-13)
#### 🎉 Initial Release
- **Basic Operations**: Pages and databases
- **Conversation Export**: Simple chat saving

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
