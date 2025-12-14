# Notion Extension Playbook v2.4

## Purpose
Full-featured Notion integration for Gemini CLI. Manage your entire Notion workspace - pages, databases, blocks, comments, users, projects, and conversation exports.

---

## 🎤 VOICE TRANSCRIPTION & CONTEXT UNDERSTANDING

### User Input Reality
Users often speak via voice transcription. Expect:
- **Fragmented phrases**: "database" → "project" → "CLI"
- **Misspellings**: "no shun" = "Notion", "data base" = "database"
- **Partial words**: "conv" = "conversation", "proj" = "project"
- **Wrong words**: "ocean" = "Notion", "extension" = "extension"
- **No punctuation**: continuous stream of words
- **Context switches**: jumping between topics mid-sentence

### 🧠 CONTEXT INTERPRETATION RULES

#### Rule A: Interpret Fragmented Input
When user says disconnected words, piece together intent:

| User Says | Interpret As |
|-----------|--------------|
| "search... CLI project... database" | Search databases for "CLI project" |
| "notion... conversations... export" | Export conversation to Notion |
| "delete... that page... meeting notes" | Delete page titled "meeting notes" |
| "project... status... in progress" | Update project status to "In Progress" |
| "find... yesterday... changes" | Get pages modified yesterday |

#### Rule B: Phonetic Matching
Match misspelled/misheard words to Notion concepts:

| Heard As | Means |
|----------|-------|
| "no shun", "ocean", "motion" | Notion |
| "data base", "database", "base" | database |
| "page", "pages", "paged" | page |
| "block", "blocks", "blog" | block |
| "comment", "comments", "common" | comment |
| "conv", "convo", "conversation" | conversation |
| "proj", "project", "projected" | project |
| "temp", "template", "templated" | template |
| "export", "exported", "sport" | export |
| "search", "searched", "surge" | search |

#### Rule C: Context-Based Inference
Use conversation history to fill gaps:

**Example 1:**
- User earlier: "Show me my project databases"
- User now: "the second one"
→ Select the 2nd database from previous results

**Example 2:**
- User earlier: "Search for meeting notes"
- User now: "delete it"
→ Delete the page found in previous search

**Example 3:**
- User earlier: "Create a page called Weekly Report"
- User now: "add some content... introduction section"
→ Append introduction section to "Weekly Report" page

#### Rule D: Multiple Points → Hierarchy
When user mentions multiple things, organize them:

**User says:** "I need to search CLI project, then update status, also export conversation and check the database schema"

**Break down as:**
1. **Search**: Find "CLI project"
2. **Update**: Change status (infer from context or use "In Progress")
3. **Export**: Export current conversation to Notion
4. **Check**: Get database schema

**Execute in logical order. Report results hierarchically.**

#### Rule E: Confidence-Based Response

| Confidence | Action |
|------------|--------|
| **High** (clear intent) | Execute immediately, no options shown |
| **Medium** (2-3 possibilities) | Pick most likely, mention alternatives briefly |
| **Low** (many possibilities) | List top 3-5 options with one-line descriptions |

**High Confidence Examples:**
- "export conversation" → Export immediately
- "list my databases" → List databases immediately
- "delete Meeting Notes page" → Delete immediately

**Medium Confidence Examples:**
- "show me projects" → Show projects database, mention "Did you mean project pages?"
- "update it" → Update most recent item, mention what was updated

**Low Confidence Examples:**
- "database" (alone) → List options: search? list? query? create?
- "help" → Show tool categories with brief descriptions

### 🎯 SMART DEFAULTS

When information is missing, use smart defaults:

| Missing | Default |
|---------|---------|
| **Date** | Today |
| **Status** | "In Progress" or first option |
| **Title** | Generate from context |
| **Tags** | Infer from conversation content |
| **Languages** | Detect from code blocks |
| **Parent** | Most recently used database/page |
| **Limit** | 20 results |

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

## 🎯 DECISION TREE: What Tool to Use?

```
User Input
├─ "save", "export", "store this", "upload"
│  └─→ export_conversation (auto-generate everything)
│
├─ "delete", "remove", "archive"
│  ├─→ notion_search (find the page first)
│  └─→ delete_page (use EXACT ID from search)
│
├─ "search", "find", "look for"
│  └─→ notion_search
│
├─ "show projects", "list projects", "my projects"
│  └─→ list_projects
│
├─ "recent", "latest", "what changed"
│  └─→ get_recent_changes OR query_database with timestamp sort
│
├─ "create page", "new page", "add page"
│  └─→ create_page
│
├─ "create database", "new database"
│  └─→ create_database
│
├─ "add column", "new property", "modify schema"
│  └─→ update_database_schema
│
├─ "link", "associate", "connect to project"
│  └─→ link_conversation_to_project
│
└─ Query about data
   └─→ query_database with appropriate filters
```

---

## 🔄 WORKFLOWS

### Workflow 1: Export Conversation (One-Click)
```
User: "export this" / "save to Notion"
    ↓
Step 1: Auto-generate title from first meaningful topic
Step 2: Detect languages from code blocks (TypeScript, Python, etc.)
Step 3: Infer tags from discussion context
Step 4: Set Export Date = today
Step 5: Execute export_conversation immediately
    ↓
Result: "✓ Exported: [Title] - https://notion.so/page-id"
```

### Workflow 2: Delete Page (Search → Delete)
```
User: "delete the [page name]"
    ↓
Step 1: notion_search for the page
Step 2: Get EXACT ID from search results
Step 3: delete_page with that exact ID
    ↓
Result: "✓ Deleted: [Page Name]"
```

### Workflow 3: Query Recent Items
```
User: "show recent conversations" / "what was edited today"
    ↓
Step 1: query_database with sorts:
        [{"timestamp": "last_edited_time", "direction": "descending"}]
Step 2: Display results with titles and dates
    ↓
Result: List of recent items
```

---

## 🔍 SEARCH

### notion_search
Search across entire workspace. **Returns exact page IDs - use them!**
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

## ⚡ PERFORMANCE OPTIMIZATION

### Large Conversations (>100KB)
1. Automatically chunk into multiple pages
2. Create index page linking all chunks
3. Title format: "Part X of Y"

### Rate Limit Awareness
- Notion allows 3 requests/second
- For bulk operations, space them ~350ms apart
- If rate limited, wait and retry

### Caching Strategy
- Database schema: Cache for 24 hours (rarely changes)
- Project lists: Cache for 5 minutes
- Single pages: Always fetch fresh

---

## 🚨 ERROR HANDLING

### Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `Database not found` | Wrong ID | Search for database first |
| `Page not found` | Wrong ID or deleted | Verify page exists |
| `Rate limited (429)` | Too many requests | Wait 2 seconds, retry |
| `Unauthorized (401)` | Invalid API key | Check NOTION_API_KEY |
| `Forbidden (403)` | No permission | Share page with integration |
| `Property not found` | Wrong filter/sort | Use timestamp sorts for time |

### Recovery Actions
- **If search fails:** Try broader search terms
- **If create fails:** Check parent ID exists
- **If delete fails:** Verify exact page ID from search
- **If query fails:** Use timestamp sorts, not property sorts for time

---

## 📋 QUICK REFERENCE

### Must-Remember Rules
1. **Use EXACT IDs** from search results - never make up IDs
2. **Timestamp sorts:** `{"timestamp": "last_edited_time"}` not property
3. **No confirmation needed** - just execute immediately
4. **Auto-generate** titles, tags, dates from context

### Example Commands
```
"export this" → export_conversation (auto-everything)
"delete [name]" → search → delete with exact ID
"recent pages" → query with timestamp sort descending
"add column X" → update_database_schema
```

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
