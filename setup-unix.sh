#!/bin/bash
# Gemini CLI Notion Extension - Complete Setup Script for macOS/Linux
# Fully automatic setup - just run and follow prompts

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

echo ""
echo -e "${CYAN}=============================================${NC}"
echo -e "${CYAN}   Gemini CLI Notion Extension Setup${NC}"
echo -e "${CYAN}=============================================${NC}"
echo ""

# Detect OS
OS="$(uname -s)"
case "${OS}" in
    Darwin*)    PLATFORM="macos";;
    Linux*)     PLATFORM="linux";;
    *)          echo -e "${RED}Unsupported OS: ${OS}${NC}"; exit 1;;
esac

echo -e "${GRAY}Detected platform: ${PLATFORM}${NC}"
echo ""

# Function to store credential
store_credential() {
    local name="$1"
    local value="$2"
    
    if [ "$PLATFORM" = "macos" ]; then
        # macOS Keychain
        security delete-generic-password -s "gemini-notion-extension" -a "$name" 2>/dev/null || true
        security add-generic-password -s "gemini-notion-extension" -a "$name" -w "$value"
        echo -e "${GREEN}      ✓ Stored in macOS Keychain${NC}"
    else
        # Linux - libsecret
        if command -v secret-tool &> /dev/null; then
            echo "$value" | secret-tool store --label="Gemini Notion Extension - $name" \
                service gemini-notion-extension account "$name"
            echo -e "${GREEN}      ✓ Stored in GNOME Keyring${NC}"
        else
            echo -e "${YELLOW}      ⚠ secret-tool not found, using environment variable${NC}"
            echo "export NOTION_API_KEY='$value'" >> ~/.bashrc
            echo "export NOTION_API_KEY='$value'" >> ~/.zshrc 2>/dev/null || true
            echo -e "${GREEN}      ✓ Added to shell profile${NC}"
        fi
    fi
}

# Function to test Notion connection
test_connection() {
    local token="$1"
    
    response=$(curl -s -w "\n%{http_code}" -X GET "https://api.notion.com/v1/users/me" \
        -H "Authorization: Bearer $token" \
        -H "Notion-Version: 2022-06-28" \
        -H "Content-Type: application/json")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        name=$(echo "$body" | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)
        echo -e "${GREEN}      ✓ Connected as: ${name}${NC}"
        return 0
    else
        echo -e "${RED}      ✗ Connection failed (HTTP $http_code)${NC}"
        return 1
    fi
}

# Function to search databases
search_databases() {
    local token="$1"
    
    response=$(curl -s -X POST "https://api.notion.com/v1/search" \
        -H "Authorization: Bearer $token" \
        -H "Notion-Version: 2022-06-28" \
        -H "Content-Type: application/json" \
        -d '{"filter":{"property":"object","value":"database"},"page_size":100}')
    
    echo "$response"
}

# Function to search pages
search_pages() {
    local token="$1"
    
    response=$(curl -s -X POST "https://api.notion.com/v1/search" \
        -H "Authorization: Bearer $token" \
        -H "Notion-Version: 2022-06-28" \
        -H "Content-Type: application/json" \
        -d '{"filter":{"property":"object","value":"page"},"page_size":10}')
    
    echo "$response"
}

# Function to create database
create_database() {
    local token="$1"
    local parent_id="$2"
    local title="$3"
    
    response=$(curl -s -X POST "https://api.notion.com/v1/databases" \
        -H "Authorization: Bearer $token" \
        -H "Notion-Version: 2022-06-28" \
        -H "Content-Type: application/json" \
        -d "{
            \"parent\": {\"type\": \"page_id\", \"page_id\": \"$parent_id\"},
            \"title\": [{\"type\": \"text\", \"text\": {\"content\": \"$title\"}}],
            \"properties\": {
                \"Title\": {\"title\": {}},
                \"Conversation ID\": {\"rich_text\": {}},
                \"Export Date\": {\"date\": {}},
                \"Message Count\": {\"number\": {}},
                \"Tags\": {\"multi_select\": {\"options\": [
                    {\"name\": \"development\", \"color\": \"blue\"},
                    {\"name\": \"documentation\", \"color\": \"green\"},
                    {\"name\": \"debugging\", \"color\": \"red\"}
                ]}},
                \"Languages\": {\"multi_select\": {\"options\": [
                    {\"name\": \"TypeScript\", \"color\": \"blue\"},
                    {\"name\": \"Python\", \"color\": \"yellow\"},
                    {\"name\": \"JavaScript\", \"color\": \"orange\"}
                ]}}
            }
        }")
    
    echo "$response"
}

# Step 1: Get API Token
echo -e "${YELLOW}[1/4] Enter your Notion Integration Token${NC}"
echo -e "${GRAY}      (Get it from: https://www.notion.so/my-integrations)${NC}"
echo ""
echo -n "Token: "
read -s token
echo ""

if [ -z "$token" ]; then
    echo -e "\n${RED}✗ Token cannot be empty!${NC}"
    exit 1
fi

if [[ ! "$token" == secret_* ]]; then
    echo -e "\n${YELLOW}⚠ Warning: Notion tokens typically start with 'secret_'${NC}"
    echo -n "Continue anyway? (y/N): "
    read confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo "Setup cancelled."
        exit 0
    fi
fi

# Step 2: Test Connection
echo -e "\n${YELLOW}[2/4] Testing Notion connection...${NC}"
if ! test_connection "$token"; then
    echo -e "\n${RED}Please check your token and try again.${NC}"
    exit 1
fi

# Step 3: Discover Databases
echo -e "\n${YELLOW}[3/4] Discovering your Notion databases...${NC}"

db_response=$(search_databases "$token")

# Debug: Check if response is valid
if [ -z "$db_response" ]; then
    echo -e "${RED}      ✗ Empty response from Notion API${NC}"
    exit 1
fi

# Check for API errors
if echo "$db_response" | grep -q '"status":4'; then
    echo -e "${RED}      ✗ API Error - Check token permissions${NC}"
    echo "$db_response" | grep -o '"message":"[^"]*"' | head -1
    exit 1
fi

# Parse databases using simpler method
declare -a db_ids
declare -a db_titles
db_count=0

# Check if jq is available for better parsing
if command -v jq &> /dev/null; then
    # Use jq for reliable parsing
    while IFS=$'\t' read -r id title; do
        if [ -n "$id" ] && [ "$id" != "null" ]; then
            db_ids+=("$id")
            db_titles+=("${title:-Untitled}")
            ((db_count++))
        fi
    done < <(echo "$db_response" | jq -r '.results[]? | [.id, (.title[0]?.plain_text // "Untitled")] | @tsv' 2>/dev/null)
else
    # Fallback: Extract IDs from results array
    # This regex-based approach is more reliable
    echo -e "${GRAY}      (Installing jq recommended for better parsing)${NC}"
    
    # Extract all database IDs
    ids_raw=$(echo "$db_response" | grep -oP '"id"\s*:\s*"[0-9a-f-]{36}"' | grep -oP '[0-9a-f-]{36}')
    
    # Extract all plain_text titles
    titles_raw=$(echo "$db_response" | grep -oP '"plain_text"\s*:\s*"[^"]*"' | sed 's/"plain_text"\s*:\s*"//g' | sed 's/"$//g')
    
    # Convert to arrays
    while IFS= read -r id; do
        if [ -n "$id" ]; then
            db_ids+=("$id")
        fi
    done <<< "$ids_raw"
    
    while IFS= read -r title; do
        if [ -n "$title" ]; then
            db_titles+=("$title")
        fi
    done <<< "$titles_raw"
    
    db_count=${#db_ids[@]}
fi

# Handle no databases found
if [ $db_count -eq 0 ]; then
    echo -e "${YELLOW}      No databases found in your workspace.${NC}"
    echo -e "${GRAY}      Make sure you've shared databases with your integration.${NC}"
    echo ""
    echo -e "${CYAN}      Options:${NC}"
    echo -e "      1. Share existing databases with your integration in Notion"
    echo -e "      2. Continue to create a new Gemini Conversations database"
    echo ""
    echo -n "      Continue without existing databases? (Y/n): "
    read continue_choice
    if [ "$continue_choice" = "n" ] || [ "$continue_choice" = "N" ]; then
        echo -e "\n${YELLOW}Setup paused. Share databases with your integration and run again.${NC}"
        exit 0
    fi
else
    echo -e "\n${GREEN}      Found ${db_count} database(s):${NC}"
fi

conversation_db=""
project_db=""

for ((i=0; i<db_count; i++)); do
    marker=""
    title="${db_titles[$i]:-Untitled}"
    
    # Auto-detect databases
    if [[ "${title,,}" == *"conversation"* ]] || [[ "${title,,}" == *"gemini"* ]]; then
        if [ -z "$conversation_db" ]; then
            conversation_db="${db_ids[$i]}"
            marker=" ${CYAN}[Auto: Conversation DB]${NC}"
        fi
    fi
    if [[ "${title,,}" == *"project"* ]] || [[ "${title,,}" == *"tracker"* ]]; then
        if [ -z "$project_db" ]; then
            project_db="${db_ids[$i]}"
            marker=" ${CYAN}[Auto: Project DB]${NC}"
        fi
    fi
    
    echo -e "      [$((i+1))] ${title}${marker}"
done

# Select Project Database
echo ""
if [ -n "$project_db" ]; then
    proj_title=""
    for ((i=0; i<db_count; i++)); do
        if [ "${db_ids[$i]}" = "$project_db" ]; then
            proj_title="${db_titles[$i]}"
            break
        fi
    done
    echo -e "${GREEN}      Project database auto-detected: ${proj_title}${NC}"
    echo -n "      Press Enter to keep, or enter number to change: "
    read change
    if [ -n "$change" ]; then
        idx=$((change - 1))
        if [ $idx -ge 0 ] && [ $idx -lt $db_count ]; then
            project_db="${db_ids[$idx]}"
            echo -e "${GREEN}      ✓ Selected: ${db_titles[$idx]}${NC}"
        fi
    fi
else
    echo -n "      Select PROJECT database (enter number, or skip): "
    read idx
    if [ -n "$idx" ]; then
        idx=$((idx - 1))
        if [ $idx -ge 0 ] && [ $idx -lt $db_count ]; then
            project_db="${db_ids[$idx]}"
            echo -e "${GREEN}      ✓ Selected: ${db_titles[$idx]}${NC}"
        fi
    fi
fi

# Select or Create Conversation Database
echo ""
if [ -n "$conversation_db" ]; then
    conv_title=""
    for ((i=0; i<db_count; i++)); do
        if [ "${db_ids[$i]}" = "$conversation_db" ]; then
            conv_title="${db_titles[$i]}"
            break
        fi
    done
    echo -e "${GREEN}      Conversation database auto-detected: ${conv_title}${NC}"
    echo -n "      Press Enter to keep, enter number to change, or 'new' to create: "
    read change
else
    echo -e "${YELLOW}      No conversation database found.${NC}"
    echo -n "      Enter number to select, or press Enter to create new: "
    read change
fi

if [ "$change" = "new" ] || { [ -z "$conversation_db" ] && [ -z "$change" ]; }; then
    echo -e "\n${YELLOW}      Creating 'Gemini Conversations' database...${NC}"
    
    # Find a parent page
    page_response=$(search_pages "$token")
    parent_id=$(echo "$page_response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [ -z "$parent_id" ]; then
        echo -e "${RED}      ✗ No pages found. Please share at least one page with your integration.${NC}"
        exit 1
    fi
    
    # Create database
    create_response=$(create_database "$token" "$parent_id" "Gemini Conversations")
    conversation_db=$(echo "$create_response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [ -n "$conversation_db" ]; then
        echo -e "${GREEN}      ✓ Created 'Gemini Conversations' database${NC}"
    else
        echo -e "${RED}      ✗ Failed to create database${NC}"
        exit 1
    fi
elif [ -n "$change" ] && [ "$change" != "new" ]; then
    idx=$((change - 1))
    if [ $idx -ge 0 ] && [ $idx -lt $db_count ]; then
        conversation_db="${db_ids[$idx]}"
        echo -e "${GREEN}      ✓ Selected: ${db_titles[$idx]}${NC}"
    fi
fi

# Step 4: Save Configuration
echo -e "\n${YELLOW}[4/4] Saving configuration...${NC}"

# Store credential
store_credential "NOTION_API_KEY" "$token"

# Also set environment variable for current session
export NOTION_API_KEY="$token"

# Save database IDs to cache file
cat > .notion-cache.json << EOF
{
  "conversationDbId": "$conversation_db",
  "projectDbId": "$project_db",
  "lastUpdated": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

echo -e "${GREEN}      ✓ Database IDs cached${NC}"

# Summary
echo ""
echo -e "${GREEN}=============================================${NC}"
echo -e "${GREEN}   Setup Complete!${NC}"
echo -e "${GREEN}=============================================${NC}"
echo ""
echo -e "${WHITE}   Conversation DB: ${conversation_db}${NC}"
echo -e "${WHITE}   Project DB:      ${project_db}${NC}"
echo ""
echo -e "${CYAN}   Next steps:${NC}"
echo -e "${WHITE}   1. npm run build${NC}"
echo -e "${WHITE}   2. gemini extensions link .${NC}"
echo -e "${WHITE}   3. gemini${NC}"
echo ""
