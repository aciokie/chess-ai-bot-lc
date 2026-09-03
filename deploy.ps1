<# 
.SYNOPSIS
    Deploy Chess AI Bot to GitHub with auto-update support
.PARAMETER GitHubUsername
    Your GitHub username (required)
.EXAMPLE
    .\deploy.ps1 johndoe
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$GitHubUsername
)

$RepoName = "chess-ai-bot"
$RepoDir = "$env:TEMP\$RepoName"

Write-Host "🚀 Deploying Chess AI Bot for user: $GitHubUsername" -ForegroundColor Green

# Update userscript with actual username
$UserScriptPath = "chess-ai-bot.user.js"
$DistPath = "dist\chess-ai-bot.user.js"

$content = Get-Content $UserScriptPath -Raw
$content = $content -replace '{{GITHUB_USERNAME}}', $GitHubUsername
Set-Content -Path $UserScriptPath -Value $content -Encoding UTF8

if (Test-Path $DistPath) {
    $distContent = Get-Content $DistPath -Raw
    $distContent = $distContent -replace '{{GITHUB_USERNAME}}', $GitHubUsername
    Set-Content -Path $DistPath -Value $distContent -Encoding UTF8
}

Write-Host "✅ Updated @updateURL and @downloadURL in userscript" -ForegroundColor Green

# Build fresh
Write-Host "🔨 Building..." -ForegroundColor Cyan
npm run build

$distContent = Get-Content $DistPath -Raw
$distContent = $distContent -replace '{{GITHUB_USERNAME}}', $GitHubUsername
Set-Content -Path $DistPath -Value $distContent -Encoding UTF8

# Create temp repo
if (Test-Path $RepoDir) { Remove-Item -Recurse -Force $RepoDir }
New-Item -ItemType Directory -Path "$RepoDir\dist" -Force | Out-Null
New-Item -ItemType Directory -Path "$RepoDir\tests" -Force | Out-Null
New-Item -ItemType Directory -Path "$RepoDir\src" -Force | Out-Null

# Copy files
Copy-Item $UserScriptPath "$RepoDir\"
Copy-Item $DistPath "$RepoDir\dist\"
Copy-Item "package.json" "$RepoDir\"
Copy-Item "README.md" "$RepoDir\" -ErrorAction SilentlyContinue
Copy-Item "LICENSE" "$RepoDir\" -ErrorAction SilentlyContinue
Copy-Item -Recurse "src" "$RepoDir\"
Copy-Item -Recurse "tests" "$RepoDir\"
Copy-Item "vitest.config.js" "$RepoDir\" -ErrorAction SilentlyContinue
Copy-Item "playwright.config.js" "$RepoDir\" -ErrorAction SilentlyContinue
Copy-Item ".eslintrc.json" "$RepoDir\" -ErrorAction SilentlyContinue
Copy-Item ".prettierrc" "$RepoDir\" -ErrorAction SilentlyContinue
if (Test-Path ".github\workflows\test.yml") {
    New-Item -ItemType Directory -Path "$RepoDir\.github\workflows" -Force | Out-Null
    Copy-Item ".github\workflows\test.yml" "$RepoDir\.github\workflows\"
}

# Create README if missing
if (-not (Test-Path "$RepoDir\README.md")) {
    $readme = [System.IO.File]::ReadAllText("README.template.md")
    $readme = $readme -replace 'GITHUB_USERNAME_PLACEHOLDER', $GitHubUsername
    Set-Content -Path "$RepoDir\README.md" -Value $readme -Encoding UTF8
}

Set-Location $RepoDir

# Init git
git init
git config user.name "$GitHubUsername"
git config user.email "$GitHubUsername@users.noreply.github.com"
git add .
git commit -m "Chess AI Bot v1.0.0 - Stockfish 18 WASM userscript"
git branch -M main

Write-Host ""
Write-Host "📦 Repository ready at: $RepoDir" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Create repo on GitHub: https://github.com/new"
Write-Host "   - Name: chess-ai-bot"
Write-Host "   - Public (required for raw.githubusercontent.com)"
Write-Host "   - Don't initialize with README"
Write-Host ""
Write-Host "2. Push:"
Write-Host "   cd $RepoDir"
Write-Host "   git remote add origin https://github.com/$GitHubUsername/chess-ai-bot.git"
Write-Host "   git push -u origin main"
Write-Host ""
Write-Host "3. Install link for users:" -ForegroundColor Cyan
Write-Host "   https://raw.githubusercontent.com/$GitHubUsername/chess-ai-bot/main/chess-ai-bot.user.js"
Write-Host ""
Write-Host "4. jsDelivr CDN (optional, faster):" -ForegroundColor Cyan
Write-Host "   https://cdn.jsdelivr.net/gh/$GitHubUsername/chess-ai-bot@main/dist/chess-ai-bot.user.js"