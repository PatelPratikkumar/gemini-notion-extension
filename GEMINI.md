# Notion Extension Playbook v2.1

## Purpose
Full-featured Notion integration for Gemini CLI. Manage your entire Notion workspace - pages, databases, blocks, comments, users, projects, and conversation exports.

---

## ⚡ CRITICAL BEHAVIOR RULES

**DO NOT ASK QUESTIONS. JUST DO IT.**

When user says "export conversation" or "save to Notion":
1. **Auto-generate title** from conversation topic (e.g., "Notion Extension Development - Dec 14")
2. **Auto-detect languages** from code in conversation (TypeScript, Python, etc.)
3. **Auto-detect tags** from context (development, debugging, documentation, etc.)
4. **Auto-fill date** as current date
5. **Execute immediately** - do NOT ask for confirmation

When user says "create page" without details:
- Generate sensible title from context
- Create it immediately

When user says "create project" without details:
- Use conversation context for project name
- Set status to "Planning" by default
- Create it immediately

**NEVER ask:**
- "What title would you like?"
- "Do you want to add tags?"
- "Does that sound good?"
- "What properties should I fill?"

**ALWAYS just do it with smart defaults.**

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
