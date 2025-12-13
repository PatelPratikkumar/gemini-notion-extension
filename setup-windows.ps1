# Gemini CLI Notion Extension - Complete Setup Script
# Fully automatic setup - just run and follow prompts

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   Gemini CLI Notion Extension Setup" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

$headers = @{
    "Notion-Version" = "2022-06-28"
    "Content-Type" = "application/json"
}

# Step 1: Get API Token
Write-Host "[1/4] Enter your Notion Integration Token" -ForegroundColor Yellow
Write-Host "      (Get it from: https://www.notion.so/my-integrations)" -ForegroundColor Gray
Write-Host ""
$tokenSecure = Read-Host -AsSecureString "Token"
$token = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($tokenSecure))

if ([string]::IsNullOrWhiteSpace($token)) {
    Write-Host "`n✗ Token cannot be empty!" -ForegroundColor Red
    exit 1
}

$headers["Authorization"] = "Bearer $token"

# Step 2: Test Connection
Write-Host "`n[2/4] Testing Notion connection..." -ForegroundColor Yellow
try {
    $user = Invoke-RestMethod -Uri "https://api.notion.com/v1/users/me" -Headers $headers -Method Get
    Write-Host "      ✓ Connected as: $($user.name)" -ForegroundColor Green
} catch {
    Write-Host "      ✗ Connection failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "      Please check your token and try again." -ForegroundColor Gray
    exit 1
}

# Step 3: Discover Databases
Write-Host "`n[3/4] Discovering your Notion databases..." -ForegroundColor Yellow

$searchBody = @{
    filter = @{
        property = "object"
        value = "database"
    }
    page_size = 100
} | ConvertTo-Json

try {
    $searchResult = Invoke-RestMethod -Uri "https://api.notion.com/v1/search" -Headers $headers -Method Post -Body $searchBody
} catch {
    Write-Host "      ✗ Failed to search databases: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$databases = @()
$conversationDb = $null
$projectDb = $null

foreach ($db in $searchResult.results) {
    if ($db.object -eq "database" -and $db.title.Count -gt 0) {
        $title = $db.title[0].plain_text
        $databases += @{
            id = $db.id
            title = $title
            parent = $db.parent
        }
        
        # Auto-detect conversation database
        if ($title -match "conversation|gemini" -and -not $conversationDb) {
            $conversationDb = $db.id
        }
        # Auto-detect project database
        if ($title -match "project|tracker" -and -not $projectDb) {
            $projectDb = $db.id
        }
    }
}

Write-Host "`n      Found $($databases.Count) database(s):" -ForegroundColor Green
for ($i = 0; $i -lt $databases.Count; $i++) {
    $marker = ""
    if ($databases[$i].id -eq $projectDb) { $marker = " [Auto-selected as Project DB]" }
    if ($databases[$i].id -eq $conversationDb) { $marker = " [Auto-selected as Conversation DB]" }
    Write-Host "      [$($i+1)] $($databases[$i].title)$marker" -ForegroundColor White
}

# Step 3a: Select Project Database
Write-Host ""
if ($projectDb) {
    $projTitle = ($databases | Where-Object { $_.id -eq $projectDb }).title
    Write-Host "      Project database auto-detected: $projTitle" -ForegroundColor Green
    $change = Read-Host "      Press Enter to keep, or enter number to change"
    if ($change -ne "") {
        $idx = [int]$change - 1
        if ($idx -ge 0 -and $idx -lt $databases.Count) {
            $projectDb = $databases[$idx].id
            Write-Host "      ✓ Selected: $($databases[$idx].title)" -ForegroundColor Green
        }
    }
} else {
    Write-Host "      Select your PROJECT database (enter number): " -ForegroundColor Yellow -NoNewline
    $idx = [int](Read-Host) - 1
    if ($idx -ge 0 -and $idx -lt $databases.Count) {
        $projectDb = $databases[$idx].id
        Write-Host "      ✓ Selected: $($databases[$idx].title)" -ForegroundColor Green
    } else {
        Write-Host "      ⚠ No project database selected" -ForegroundColor Yellow
    }
}

# Step 3b: Select or Create Conversation Database
Write-Host ""
if ($conversationDb) {
    $convTitle = ($databases | Where-Object { $_.id -eq $conversationDb }).title
    Write-Host "      Conversation database auto-detected: $convTitle" -ForegroundColor Green
    $change = Read-Host "      Press Enter to keep, or enter number to change, or 'new' to create"
} else {
    Write-Host "      No conversation database found." -ForegroundColor Yellow
    Write-Host "      Enter number to select existing, or press Enter to create new: " -ForegroundColor Yellow -NoNewline
    $change = Read-Host
}

if ($change -eq "new" -or (-not $conversationDb -and $change -eq "")) {
    # Need to create conversation database - find a parent page
    Write-Host "`n      Creating 'Gemini Conversations' database..." -ForegroundColor Yellow
    
    # Search for any page to use as parent
    $pageSearchBody = @{
        filter = @{ property = "object"; value = "page" }
        page_size = 10
    } | ConvertTo-Json
    
    $pageResult = Invoke-RestMethod -Uri "https://api.notion.com/v1/search" -Headers $headers -Method Post -Body $pageSearchBody
    $parentPageId = $null
    
    foreach ($page in $pageResult.results) {
        if ($page.object -eq "page") {
            $parentPageId = $page.id
            break
        }
    }
    
    if (-not $parentPageId) {
        Write-Host "      ✗ No pages found. Please share at least one page with your integration." -ForegroundColor Red
        Write-Host "      In Notion: Open any page > Share > Add connection > Select your integration" -ForegroundColor Gray
        exit 1
    }
    
    # Create the database
    $createDbBody = @{
        parent = @{ type = "page_id"; page_id = $parentPageId }
        title = @(@{ type = "text"; text = @{ content = "Gemini Conversations" } })
        properties = @{
            "Title" = @{ title = @{} }
            "Conversation ID" = @{ rich_text = @{} }
            "Export Date" = @{ date = @{} }
            "Message Count" = @{ number = @{} }
            "Tags" = @{ multi_select = @{ options = @(
                @{ name = "development"; color = "blue" }
                @{ name = "documentation"; color = "green" }
                @{ name = "debugging"; color = "red" }
            )}}
            "Languages" = @{ multi_select = @{ options = @(
                @{ name = "TypeScript"; color = "blue" }
                @{ name = "Python"; color = "yellow" }
                @{ name = "JavaScript"; color = "orange" }
            )}}
        }
    } | ConvertTo-Json -Depth 10
    
    try {
        $newDb = Invoke-RestMethod -Uri "https://api.notion.com/v1/databases" -Headers $headers -Method Post -Body $createDbBody
        $conversationDb = $newDb.id
        Write-Host "      ✓ Created 'Gemini Conversations' database" -ForegroundColor Green
    } catch {
        Write-Host "      ✗ Failed to create database: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
} elseif ($change -ne "") {
    $idx = [int]$change - 1
    if ($idx -ge 0 -and $idx -lt $databases.Count) {
        $conversationDb = $databases[$idx].id
        Write-Host "      ✓ Selected: $($databases[$idx].title)" -ForegroundColor Green
    }
}

# Step 4: Save Configuration
Write-Host "`n[4/4] Saving configuration..." -ForegroundColor Yellow

# Save to environment variable (permanent)
[System.Environment]::SetEnvironmentVariable("NOTION_API_KEY", $token, [System.EnvironmentVariableTarget]::User)
$env:NOTION_API_KEY = $token
Write-Host "      ✓ API key saved to environment" -ForegroundColor Green

# Save database IDs to cache file
$cache = @{
    conversationDbId = $conversationDb
    projectDbId = $projectDb
    lastUpdated = (Get-Date).ToString("o")
} | ConvertTo-Json

$cache | Out-File -FilePath ".notion-cache.json" -Encoding UTF8
Write-Host "      ✓ Database IDs cached" -ForegroundColor Green

# Summary
Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "   Setup Complete!" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "   Conversation DB: $conversationDb" -ForegroundColor White
Write-Host "   Project DB:      $projectDb" -ForegroundColor White
Write-Host ""
Write-Host "   Next steps:" -ForegroundColor Cyan
Write-Host "   1. npm run build" -ForegroundColor White
Write-Host "   2. gemini extensions link ." -ForegroundColor White
Write-Host ""
