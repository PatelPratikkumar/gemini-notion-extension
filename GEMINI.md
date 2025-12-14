# Notion Extension Playbook v2.3

## Purpose
Full-featured Notion integration for Gemini CLI. Manage your entire Notion workspace - pages, databases, blocks, comments, users, projects, and conversation exports.

---

## ⚡ CRITICAL BEHAVIOR RULES - READ THIS FIRST!

### 🚨 RULE 1: NEVER ASK QUESTIONS. JUST DO IT.

When user says "delete this page" or "delete that":
1. Search for the page
2. Get the **actual ID from search results** (DO NOT MAKE UP IDs!)
3. Delete it immediately
4. DO NOT ask "are you sure?" - just delete it

When user says "export conversation" or "save to Notion":
1. Auto-generate title from conversation topic (e.g., "Notion Extension Dev - Dec 14")
2. Auto-detect languages from code (TypeScript, Python, etc.)
3. Auto-detect tags from context (development, debugging, documentation)
4. Set Export Date to today
5. **Execute immediately** - NO confirmation needed

### 🚨 RULE 2: USE ACTUAL IDs FROM SEARCH RESULTS

**CRITICAL:** When search returns results like:
```json
{"id": "2c881500-2ffb-8144-825a-db0ce905661f", "title": "My Page"}
```
You MUST use that exact ID: `2c881500-2ffb-8144-825a-db0ce905661f`
**NEVER make up fake IDs like `a8d5e0f7-9c1c-4f5c-b5b5-1e3f8a9d0e1b`**

### 🚨 RULE 3: SORTING BY TIME - USE TIMESTAMP NOT PROPERTY

To sort by most recent, use Notion's built-in timestamp:
```json
{"sorts": [{"timestamp": "last_edited_time", "direction": "descending"}]}
```
**NOT** `{"property": "Last Edited"}` - that property doesn't exist!

Available timestamp sorts:
- `last_edited_time` - When page was last modified
- `created_time` - When page was created

### 🚨 RULE 4: NEVER SAY THESE PHRASES
- "Is this the page you want?"
- "Would you like me to..."
- "Please confirm..."
- "Are you sure?"
- "Does that sound good?"

Just. Do. It.

---

## 📚 NOTION API FUNDAMENTALS - KNOW THESE!

### API Limits (Critical Knowledge)

| Limit | Value | Impact |
|-------|-------|--------|
| **Rate limit** | 3 requests/second | Space out bulk operations |
| **Max results per query** | 100 items | Use pagination for more |
| **Max blocks per append** | 100 blocks | Chunk large content |
| **Rich text per block** | 2,000 characters | Split long text |
| **Code block limit** | 100,000 characters | For large code |

### Pagination for Large Datasets

When fetching more than 100 items, use cursor-based pagination:
```json
{
  "page_size": 100,
  "start_cursor": "next_cursor_from_previous_response"
}
```

Response includes:
```json
{
  "results": [...],
  "has_more": true,
  "next_cursor": "abc123..."
}
```

### Property Types Reference

| Type | Use For | Example |
|------|---------|---------|
| `title` | Main name (required, one per DB) | Page title |
| `rich_text` | Text content | Description, notes |
| `number` | Numeric values | Count, price |
| `select` | Single choice | Status, priority |
| `multi_select` | Multiple tags | Languages, tags |
| `date` | Date/datetime | Due date, created |
| `checkbox` | Boolean | Is completed? |
| `url` | Links | GitHub repo, website |
| `email` | Email addresses | Contact email |
| `people` | Notion users | Assigned to, owner |
| `relation` | Link to other DB | Related projects |
| `status` | Status with groups | To Do → Done |

### Filter Syntax Examples

**Single filter:**
```json
{"property": "Status", "select": {"equals": "Active"}}
```

**Text contains:**
```json
{"property": "Title", "title": {"contains": "API"}}
```

**Date filter:**
```json
{"property": "Due Date", "date": {"on_or_before": "2024-12-31"}}
```

**Compound filter (AND):**
```json
{
  "and": [
    {"property": "Status", "select": {"equals": "Active"}},
    {"property": "Priority", "select": {"equals": "High"}}
  ]
}
```

---

## 🔍 SEARCH

### notion_search
Search across entire workspace.
```
"Find all pages about API design"
"Search for database called Project Tracker"
```

---

## 📄 PAGES

### create_page
Create new pages anywhere.
```
"Create a page called Meeting Notes under my Projects page"
"Create a new entry in my Tasks database with status Active"
```

### get_page
Read page content and properties.
```
"Get the contents of page abc123"
"Show me what's on my roadmap page"
```

### update_page
Modify page properties, title, icon.
```
"Change the title of page X to 'New Title'"
"Archive the old meeting notes page"
"Add 🚀 emoji as icon to my launch page"
```

### delete_page
Archive (delete) pages.
```
"Delete page abc123"
"Remove the outdated draft"
```

---

## 🗃️ DATABASES

### list_databases
List all accessible databases.
```
"Show me all my databases"
"What databases do I have access to?"
```

### query_database
Query with filters and sorting.
```
"Show all active projects"
"List tasks due this week sorted by priority"
"Get conversations tagged with 'api'"
```

### create_database
Create new databases.
```
"Create a Tasks database in my Projects page"
"Make a new CRM database with Name, Email, Company columns"
```

### add_database_entry
Add rows to databases.
```
"Add a new task: Review PR with status In Progress"
"Create a new project called 'Mobile App'"
```

### get_database_schema
View database structure.
```
"What columns does the Projects database have?"
"Show me the schema of conversations database"
```

### update_database_schema
Add, remove, or modify database properties (columns). **Use this to enhance databases!**

**Add new columns:**
```
"Add an 'Assigned To' people column to the conversations database"
"Add a Status property to my Tasks database"
"Add Priority (select: High/Medium/Low) to projects"
```

**Property types you can add:**
- `rich_text` - Text field
- `number` - Numeric values
- `select` - Single choice dropdown
- `multi_select` - Multiple choice tags
- `date` - Date/time picker
- `checkbox` - True/false
- `url` - Links
- `email` - Email addresses
- `people` - Notion users (Assigned To, Owner, etc.)
- `status` - Status with groups (To Do, In Progress, Done)

**Remove columns:**
```
"Remove the 'Old Field' column from projects database"
```

---

## 📝 BLOCKS (Content)

### get_block_children
Read page content as blocks.
```
"Get all content from page X"
"Show me the blocks in this document"
```

### append_blocks
Add content to pages (supports markdown).
```
"Add a paragraph to my notes page"
"Append this code snippet to the documentation"
"Add a to-do list to my tasks page"
```

### update_block
Modify existing blocks.
```
"Change the heading to say 'Updated Title'"
"Convert this paragraph to a quote"
```

### delete_block
Remove blocks.
```
"Delete that code block"
"Remove the second paragraph"
```

---

## 💬 COMMENTS

### get_comments
Read page comments.
```
"Show me comments on this page"
"What feedback is there on the proposal?"
```

### add_comment
Add comments to pages.
```
"Add a comment: 'Looks good, approved!'"
"Reply to the discussion about pricing"
```

---

## 👥 USERS

### list_users
List workspace members.
```
"Who has access to this workspace?"
"List all team members"
```

### get_current_user
Get bot/integration info.
```
"What user am I connected as?"
```

---

## 📁 PROJECTS

### list_projects
List from project database.
```
"Show my active projects"
"List all projects sorted by date"
```

### create_project
Create new projects.
```
"Create project 'Mobile Redesign' with status Planning"
"Add new project with technologies React, TypeScript"
```

### update_project
Update project details.
```
"Set project X to Completed"
"Add GitHub repo to the API project"
```

---

## 💾 CONVERSATIONS

### export_conversation
Save this chat to Notion. **Just do it - don't ask questions!**

**Auto-generate from conversation:**
- Title: Topic + Date (e.g., "API Debug Session - Dec 14")
- Languages: Detect from code blocks (TypeScript, Python, JavaScript)
- Tags: Infer from discussion (development, debugging, documentation)
- Export Date: Current date
- Message Count: Count turns in conversation

**User says:** "Export this conversation" or "Save to Notion" or "Upload conversation"
**You do:** Create page immediately with auto-generated details. NO questions.

```
"Export this conversation"
"Save our discussion"
"Upload to Notion"
```

### link_conversation_to_project
Connect conversation to project.
```
"Link this conversation to the Mobile App project"
```

---

## 🛠️ UTILITY

### duplicate_page
Copy pages.
```
"Duplicate my template page"
"Make a copy of the meeting notes"
```

### get_recent_changes
See recently modified items.
```
"What was recently changed?"
"Show me pages edited today"
```

---

## Database Shortcuts

Use these shortcuts instead of IDs:
- `"projects"` → Your configured project database
- `"conversations"` → Your configured conversation database

---

## Examples

**Multi-step workflow:**
```
1. "Create a new project called 'Q1 Launch'"
2. "Export this conversation"
3. "Link the conversation to Q1 Launch project"
```

**Database operations:**
```
"Query the projects database where status is Active, sorted by start date"
"Add entry to conversations with title 'Debug Session' and tag 'debugging'"
```

**Content management:**
```
"Create a page called 'Weekly Report' with heading and bullet list of accomplishments"
"Search for all pages mentioning 'budget' and show me the recent ones"
```
