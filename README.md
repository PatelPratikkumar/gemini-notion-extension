# 📝 Gemini CLI Notion Extension v3.0.4 Enhanced Edition

> Complete Notion workspace automation with [Gemini CLI](https://github.com/google-gemini/gemini-cli) via Model Context Protocol (MCP).

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![Gemini CLI](https://img.shields.io/badge/Gemini%20CLI-Extension-blue.svg)](https://github.com/google-gemini/gemini-cli)
[![Version](https://img.shields.io/badge/Version-3.0.4-brightgreen.svg)](https://github.com/PatelPratikkumar/gemini-notion-extension/releases)

Transform your Notion workspace into a powerful automation hub with 46 comprehensive tools, file processing, database templates, and intelligent monitoring.

## ✨ v3.0.3 Enhanced Features (Bug Fix Release)

- **🔧 Critical Fix**: MCP server registration for proper Gemini CLI tool discovery
- **🐛 Fixed upload_file_to_notion**: Honest implementation with proper file handling modes
- **🐛 Improved Error Handling**: Better database parent resolution for create_page function
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

### New in v3.0.3: Enhanced Tool Categories + Bug Fixes

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

## 🚀 Installation & Setup

### 📖 **IMPORTANT: Two-Step Installation Process**

The Notion extension requires **both extension installation AND MCP server registration** for tools to work:

1. **Extension Installation**: Provides metadata, commands, and context
2. **MCP Server Registration**: Enables the 46 Notion tools in Gemini CLI

**If you skip step 2, you'll get "Tool not found" errors.**

---

### 🏃‍♂️ **Quick Setup (Recommended)**

```bash
# 1. Install extension with auto-update
gemini extensions install https://github.com/PatelPratikkumar/gemini-notion-extension --auto-update

# 2. Get your Notion API token (see section below)
# Set as environment variable:
setx NOTION_API_KEY "your_notion_token_here"  # Windows
export NOTION_API_KEY="your_notion_token_here"  # macOS/Linux

# 3. Register MCP server for tool access
gemini mcp add notion node "~/.gemini/extensions/notion-extension/dist/bundle.js" -e NOTION_API_KEY="${NOTION_API_KEY}" --timeout 30000 -s user

# 4. Verify installation
gemini mcp list
# Should show: ✓ notion: ... - Connected

# 5. Test tools
echo "List my Notion databases" | gemini chat
```

---

### 📋 **Prerequisites**

Before installing, ensure you have:

1. **Node.js 18+** - [Download here](https://nodejs.org/)
2. **Gemini CLI** - Install globally:
   ```bash
   npm install -g @google/gemini-cli
   ```
3. **Notion Integration Token** - Get yours below 👇

---

### 🔐 **Getting Your Notion API Token**

1. Log in to [Notion](https://www.notion.so)
2. Go to [My Integrations](https://www.notion.so/my-integrations)
3. Click **"+ New integration"**
4. Configure:
   - **Name**: `Gemini CLI Extension`
   - **Associated workspace**: Select your workspace
   - **Capabilities**: Check all Content, Comment, and User capabilities
5. Click **"Submit"**
6. Copy the **Internal Integration Token** (starts with `ntn_`)

> ⚠️ **Keep your token secret!** Never share it or commit it to git.

### 🔗 **Share Pages with Integration**

In Notion, grant access to pages/databases you want to use:
1. Open a page or database
2. Click **"Share"** (top right)
3. Click **"Add connections"** or **"Invite"**
4. Select **"Gemini CLI Extension"**

---

### 🎯 **Installation Methods**

#### **Method A: Auto-Update Installation (Recommended)**

**For production use with automatic updates:**

```bash
# 1. Install extension from GitHub
gemini extensions install https://github.com/PatelPratikkumar/gemini-notion-extension --auto-update

# 2. Set environment variable (choose your OS)
# Windows (PowerShell - restart terminal after):
setx NOTION_API_KEY "ntn_your_token_here"

# macOS/Linux (add to ~/.bashrc or ~/.zshrc):
echo 'export NOTION_API_KEY="ntn_your_token_here"' >> ~/.bashrc
source ~/.bashrc

# 3. Register MCP server (critical step!)
gemini mcp add notion node "~/.gemini/extensions/notion-extension/dist/bundle.js" \
  -e NOTION_API_KEY="${NOTION_API_KEY}" \
  --timeout 30000 \
  -s user

# 4. Verify setup
gemini mcp list
echo "What Notion tools do you have?" | gemini chat
```

**Future updates:**
```bash
# Update extension
gemini extensions update notion-extension

# MCP server automatically uses updated code
# No additional steps needed
```

#### **Method B: Development Installation**

**For local development and custom modifications:**

```bash
# 1. Clone repository
git clone https://github.com/PatelPratikkumar/gemini-notion-extension.git
cd gemini-notion-extension

# 2. Install dependencies
npm install

# 3. Set environment variable
# Windows:
setx NOTION_API_KEY "ntn_your_token_here"

# macOS/Linux:
echo 'export NOTION_API_KEY="ntn_your_token_here"' >> ~/.bashrc
source ~/.bashrc

# 4. Build extension
npm run build

# 5. Link extension
gemini extensions link .

# 6. Register MCP server with local path
gemini mcp add notion node "$(pwd)/dist/bundle.js" \
  -e NOTION_API_KEY="${NOTION_API_KEY}" \
  --timeout 30000 \
  -s user

# 7. Verify setup
gemini mcp list
```

**Development workflow:**
```bash
# After making changes:
npm run build

# MCP server automatically uses updated code
# No need to re-register
```

#### **Method C: Automated Setup Script**

**For guided setup with automatic configuration:**

```bash
# 1. Install extension
gemini extensions install https://github.com/PatelPratikkumar/gemini-notion-extension --auto-update

# 2. Navigate to extension directory
cd ~/.gemini/extensions/notion-extension

# 3. Run setup script (guides you through token setup and database configuration)
# Windows:
.\setup-windows.ps1

# macOS/Linux:
chmod +x setup-unix.sh && ./setup-unix.sh

# 4. Register MCP server (still required after setup)
gemini mcp add notion node "~/.gemini/extensions/notion-extension/dist/bundle.js" \
  -e NOTION_API_KEY="${NOTION_API_KEY}" \
  --timeout 30000 \
  -s user
```

---

## 🗑️ **Uninstallation**

### **Complete Removal**

```bash
# 1. Remove MCP server
gemini mcp remove notion

# 2. Uninstall extension
gemini extensions uninstall notion-extension

# 3. Clean environment variables (optional)
# Windows:
reg delete "HKCU\Environment" /v "NOTION_API_KEY" /f

# macOS/Linux (remove line from ~/.bashrc):
grep -v "NOTION_API_KEY" ~/.bashrc > ~/.bashrc.tmp && mv ~/.bashrc.tmp ~/.bashrc
source ~/.bashrc

# 4. Remove cached data (optional)
rm ~/.notion-cache.json  # If exists
rm ~/.gemini/extensions/notion-extension/ -rf  # If exists
```

### **Partial Removal (Keep Extension, Remove MCP Server)**

```bash
# Remove MCP server only (keeps extension for context/commands)
gemini mcp remove notion

# Extension remains available but tools won't work
# To restore tools, re-run: gemini mcp add notion...
```

---

## 🔧 **Troubleshooting**

### **"Tool not found" Errors**

**Symptom**: Extension shows as loaded but Notion tools don't work

```bash
# 1. Check if MCP server is registered
gemini mcp list
# Should show: ✓ notion: ... - Connected

# 2. If missing or disconnected, register MCP server:
gemini mcp add notion node "~/.gemini/extensions/notion-extension/dist/bundle.js" \
  -e NOTION_API_KEY="${NOTION_API_KEY}" \
  --timeout 30000 \
  -s user

# 3. Verify environment variable
echo $NOTION_API_KEY  # Should start with 'secret_' or 'ntn_'

# 4. Test connection
echo "List my Notion databases" | gemini chat
```

### **MCP Server Disconnected**

**Symptom**: `gemini mcp list` shows "Disconnected" or "Failed"

```bash
# 1. Check MCP server logs
gemini mcp logs notion

# 2. Increase timeout and re-register
gemini mcp remove notion
gemini mcp add notion node "~/.gemini/extensions/notion-extension/dist/bundle.js" \
  -e NOTION_API_KEY="${NOTION_API_KEY}" \
  --timeout 60000 \
  -s user

# 3. Check Node.js version (requires 18+)
node --version
```

### **Invalid Notion Token**

**Symptom**: "Unauthorized" or "Invalid token" errors

```bash
# 1. Verify token format
echo $NOTION_API_KEY
# Should start with 'secret_' (old format) or 'ntn_' (new format)

# 2. Test token directly
curl -H "Authorization: Bearer $NOTION_API_KEY" \
     -H "Notion-Version: 2022-06-28" \
     https://api.notion.com/v1/users/me

# 3. If invalid, get new token from Notion integrations
# Then update environment variable:
setx NOTION_API_KEY "your_new_token"  # Windows
export NOTION_API_KEY="your_new_token"  # macOS/Linux
```

### **Extension Version Conflicts**

**Symptom**: Tools work intermittently after updates

```bash
# 1. Check extension versions
gemini extensions list

# 2. Force clean reinstall
gemini extensions uninstall notion-extension
gemini mcp remove notion
gemini extensions install https://github.com/PatelPratikkumar/gemini-notion-extension --auto-update

# 3. Re-register MCP server with updated path
gemini mcp add notion node "~/.gemini/extensions/notion-extension/dist/bundle.js" \
  -e NOTION_API_KEY="${NOTION_API_KEY}" \
  --timeout 30000 \
  -s user
```

### **Environment Variable Issues**

**Windows PowerShell:**
```powershell
# Check if variable exists
echo $env:NOTION_API_KEY

# Set permanently
[Environment]::SetEnvironmentVariable("NOTION_API_KEY", "your_token", "User")

# Restart PowerShell/terminal after setting
```

**macOS/Linux:**
```bash
# Check if variable exists
echo $NOTION_API_KEY

# Add to shell profile (choose your shell)
echo 'export NOTION_API_KEY="your_token"' >> ~/.bashrc  # Bash
echo 'export NOTION_API_KEY="your_token"' >> ~/.zshrc   # Zsh
source ~/.bashrc  # Or ~/.zshrc
```

### **Common Error Messages**

| Error | Cause | Solution |
|-------|-------|----------|
| `Tool "notion_list_databases" not found` | MCP server not registered | Run `gemini mcp add notion...` |
| `MCP server 'notion' failed to start` | Invalid bundle path or environment | Check file path and `$NOTION_API_KEY` |
| `Request timed out` | Slow Notion API response | Increase `--timeout` to 60000 |
| `Unauthorized` | Invalid/expired token | Get new token from Notion integrations |
| `No databases found` | Pages not shared with integration | Share pages in Notion |

### **MCP Server Path Resolution Issues**

**Symptom**: MCP server fails to connect when using `~` (tilde) in file paths

When configuring MCP servers in `~/.gemini/settings.json`, using `~` in the `args` path causes connection failures because **the tilde is not expanded to the home directory** when the parent process launches the child process.

**Solution**: Use absolute paths instead of tilde (`~`) in the `args` field of `settings.json`:

```json
{
  "mcpServers": {
    "notion": {
      "command": "node",
      "args": ["/Users/yourname/.gemini/extensions/notion-extension/dist/bundle.js"],
      "env": {
        "NOTION_API_KEY": "ntn_your_actual_token"
      }
    }
  }
}
```

**To find your home directory path:**
```bash
# macOS/Linux
echo $HOME
# Output: /Users/yourname or /home/yourname

# Windows PowerShell
echo $env:USERPROFILE
# Output: C:\Users\yourname
```

> ⚠️ **Important**: Replace `/Users/yourname/` with your actual home directory path from the command above.

---

## ✅ **Testing Your Installation**

### **Quick Verification**

```bash
# 1. Check extension status
gemini extensions list
# Should show: ✓ notion-extension v3.0.3

# 2. Check MCP server status
gemini mcp list
# Should show: ✓ notion: ... - Connected

# 3. Test tool registry
echo "What Notion tools do you have available?" | gemini chat
# Should list 46 Notion tools

# 4. Test basic functionality
echo "List my Notion databases" | gemini chat
# Should show your accessible databases
```

### **Comprehensive Testing**

```bash
# Database operations
echo "Show me all my Notion databases with their properties" | gemini chat
echo "Query my Tasks database for incomplete items" | gemini chat

# Page operations
echo "Create a test page called 'Gemini CLI Test' with some content" | gemini chat
echo "Search for pages containing 'test'" | gemini chat

# Advanced features
echo "Get analytics for my most accessed database" | gemini chat
echo "Export my Tasks database to CSV format" | gemini chat
```

### **Expected Results**

✅ **Working Installation**:
- Extension appears in `gemini extensions list`
- MCP server shows as "Connected" in `gemini mcp list`
- All 46 Notion tools are available and functional
- Can list databases, create pages, and search content

❌ **Common Issues**:
- **"Tool not found"** = MCP server not registered (run `gemini mcp add...`)
- **"Unauthorized"** = Invalid token or pages not shared
- **"Disconnected"** = Check Node.js version and increase timeout

---

## � Extension Management & Updates

### Updating the Extension

The update method depends on how you installed the extension:

#### Git-Installed Extensions (Automatic Updates Available ✅)
If installed with `gemini extensions install https://...`:
```bash
# Update specific extension to latest version
gemini extensions update notion-extension

# Update all extensions at once
gemini extensions update --all
```

#### Locally Linked Extensions (Manual Updates Required 🔧)
If installed with `gemini extensions link .` (development):
```bash
cd /path/to/your/gemini-notion-extension
git pull origin main
npm install
npm run build
# Extension automatically reflects changes
```

#### Force Reinstall from GitHub
```bash
# For any issues or switching from local to git-managed
gemini extensions uninstall notion-extension
gemini extensions install https://github.com/PatelPratikkumar/gemini-notion-extension --auto-update
```

### Extension Management Commands

```bash
# List all installed extensions
gemini extensions list

# Check extension status and info
gemini extensions list | grep notion-extension

# Disable temporarily (keeps configuration)
gemini extensions disable notion-extension

# Re-enable extension
gemini extensions enable notion-extension

# Completely remove extension
gemini extensions uninstall notion-extension

# Validate extension integrity
gemini extensions validate .
```

### Auto-Update Setup

For automatic updates when installing:
```bash
# Install with auto-update enabled
gemini extensions install https://github.com/PatelPratikkumar/gemini-notion-extension --auto-update
```

### Version Checking

```bash
# Check current version
gemini extensions list | grep notion-extension

# View extension details
cd ~/.gemini/extensions/notion-extension
cat package.json | grep version
```

---

## �🛠️ Complete Tool Reference (46 Tools)

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

### Manual MCP Settings (`~/.gemini/settings.json`)

If you prefer to configure the MCP server directly in your Gemini settings file instead of using `gemini mcp add`, edit `~/.gemini/settings.json`:

> ⚠️ **Important**: Use **absolute paths**, not tilde (`~`). The tilde character is not expanded to the home directory when the parent process launches the child process, causing connection failures.

**Correct configuration (with absolute path):**

```json
{
  "mcpServers": {
    "notion": {
      "command": "node",
      "args": ["/Users/yourname/.gemini/extensions/notion-extension/dist/bundle.js"],
      "env": {
        "NOTION_API_KEY": "ntn_your_actual_token"
      }
    }
  }
}
```

**Incorrect configuration (will fail):**

```json
{
  "mcpServers": {
    "notion": {
      "command": "node",
      "args": ["~/.gemini/extensions/notion-extension/dist/bundle.js"],
      "env": {
        "NOTION_API_KEY": "ntn_your_actual_token"
      }
    }
  }
}
```

**Finding your home directory:**
- **macOS**: Run `echo $HOME` → `/Users/yourname`
- **Linux**: Run `echo $HOME` → `/home/yourname`
- **Windows**: Run `echo $env:USERPROFILE` → `C:\Users\yourname`

Replace `/Users/yourname/` in the example with your actual path.

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

### Extension Updates

#### "Extension update failed"
```bash
# Force reinstall from GitHub
gemini extensions uninstall notion-extension
gemini extensions install https://github.com/PatelPratikkumar/gemini-notion-extension --auto-update
```

#### "Extension is already up to date" (but you know there's a new version)
```bash
# Check GitHub for latest version, then force install
gemini extensions install https://github.com/PatelPratikkumar/gemini-notion-extension --auto-update
```

#### Local development version not updating
```bash
cd /path/to/gemini-notion-extension
git pull origin main
npm install
npm run build
```

### "Extension not loading"

1. Rebuild: `npm run build`
2. Relink: `gemini extensions uninstall notion-extension && gemini extensions link .`
3. Check status: `gemini extensions list`

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
