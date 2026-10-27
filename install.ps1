# Windows Ultra-Lightweight 1-Line Installer for Ray
# Usage: irm https://raw.githubusercontent.com/aryansharma48/ray-agent/main/install.ps1 | iex

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$InstallDir = "$HOME\.ray-agent\bin"
$PsScriptPath = "$InstallDir\ray.ps1"
$CmdPath = "$InstallDir\ray.cmd"

$Repo = "aryansharma48/ray-agent"
$ScriptUrl = "https://raw.githubusercontent.com/$Repo/main/ray.ps1"

Write-Host "Installing Ray (Ultra-Lightweight Edition)..." -ForegroundColor Cyan

# 1. Create target installation directory
if (!(Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

# 2. Download ray.ps1 directly (only ~8 KB, instant 0.1s download!)
Write-Host "Downloading ray client (8 KB)..." -ForegroundColor Gray

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13

if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
    & curl.exe -fsSL $ScriptUrl -o $PsScriptPath
} else {
    $webClient = New-Object System.Net.WebClient
    $webClient.DownloadFile($ScriptUrl, $PsScriptPath)
}

# 3. Create the global ray.cmd launcher (so 'ray' works in CMD, PowerShell, and Terminal)
$cmdContent = "@echo off`r`nsetlocal`r`nset `"SCRIPT_PATH=%~dp0ray.ps1`"`r`npowershell.exe -NoProfile -ExecutionPolicy Bypass -File `"%SCRIPT_PATH%`" %*`r`nendlocal"
Set-Content -Path $CmdPath -Value $cmdContent -Encoding ASCII

# Clean up any legacy dynamically-compiled ray.exe that triggers Defender heuristics
if (Test-Path "$InstallDir\ray.exe") {
    try { Remove-Item "$InstallDir\ray.exe" -Force } catch {}
}

# 4. Add to user PATH permanently if not already present
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($UserPath -notmatch [regex]::Escape($InstallDir)) {
    $NewPath = if ($UserPath -and !$UserPath.EndsWith(";")) { "$UserPath;$InstallDir" } else { "$UserPath$InstallDir" }
    [Environment]::SetEnvironmentVariable("Path", $NewPath, "User")
    $env:Path = "$env:Path;$InstallDir"
    Write-Host "Added $InstallDir to PATH" -ForegroundColor Gray
}

Write-Host "`nok: Ray installed successfully in <1 second! Type 'ray' to start." -ForegroundColor Green
