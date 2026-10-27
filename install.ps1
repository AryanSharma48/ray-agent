# Windows 1-Line Installer for Ray (Groq CLI)
# Usage: irm https://raw.githubusercontent.com/aryansharma48/ray-agent/main/install.ps1 | iex

$ErrorActionPreference = 'Stop'
# Crucial: Disable PowerShell's slow progress bar which throttles download speed by 20x
$ProgressPreference = 'SilentlyContinue'

$InstallDir = "$HOME\.ray-agent\bin"
$ExePath = "$InstallDir\ray.exe"
$Repo = "aryansharma48/ray-agent"
$BinaryName = "ray-windows-x64.exe"
$DownloadUrl = "https://github.com/$Repo/releases/latest/download/$BinaryName"

Write-Host "Installing Ray..." -ForegroundColor Cyan

# 1. Create target installation directory
if (!(Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

# 2. Download standalone executable at maximum network speed
Write-Host "Downloading standalone binary..." -ForegroundColor Gray

$downloadSuccess = $false
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13

    # Fast path: Use Windows built-in curl.exe if available (super fast, full bandwidth)
    if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
        & curl.exe -fSL $DownloadUrl -o $ExePath --progress-bar
        if ($LASTEXITCODE -eq 0 -and (Test-Path $ExePath)) {
            $downloadSuccess = $true
        }
    }

    # Fallback to .NET WebClient (much faster than Invoke-WebRequest)
    if (!$downloadSuccess) {
        $webClient = New-Object System.Net.WebClient
        $webClient.DownloadFile($DownloadUrl, $ExePath)
        $downloadSuccess = $true
    }
} catch {
    # If GitHub release asset is not yet available, check if node/npm is available as fallback
    if (Get-Command npm -ErrorAction SilentlyContinue) {
        Write-Host "Binary not found in release, falling back to npm..." -ForegroundColor Yellow
        & npm install -g ray-agent
        Write-Host "`nok: Ray installed successfully via npm! Run 'ray --help' to get started." -ForegroundColor Green
        return
    } else {
        Write-Host "error: Failed to download ray binary from $DownloadUrl" -ForegroundColor Red
        exit 1
    }
}

# 3. Add to user PATH permanently if not already present
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($UserPath -notmatch [regex]::Escape($InstallDir)) {
    $NewPath = if ($UserPath -and !$UserPath.EndsWith(";")) { "$UserPath;$InstallDir" } else { "$UserPath$InstallDir" }
    [Environment]::SetEnvironmentVariable("Path", $NewPath, "User")
    $env:Path = "$env:Path;$InstallDir"
    Write-Host "Added $InstallDir to PATH" -ForegroundColor Gray
}

Write-Host "`nok: Ray installed successfully! Type 'ray' to start." -ForegroundColor Green
