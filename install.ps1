# Windows Ultra-Lightweight 1-Line Installer for Ray
# Usage: irm https://raw.githubusercontent.com/aryansharma48/ray-agent/main/install.ps1 | iex

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$InstallDir = "$HOME\.ray-agent\bin"
$PsScriptPath = "$InstallDir\ray.ps1"
$CmdPath = "$InstallDir\ray.cmd"
$ExePath = "$InstallDir\ray.exe"

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

# 4. Optional: compile a 25 KB native ray.exe using Windows' built-in csc.exe if available
$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (Test-Path $csc) {
    $csharpCode = @"
using System;
using System.Diagnostics;
class Program {
    static int Main(string[] args) {
        string dir = AppDomain.CurrentDomain.BaseDirectory;
        string ps1 = System.IO.Path.Combine(dir, "ray.ps1");
        string argList = "-NoProfile -ExecutionPolicy Bypass -File \"" + ps1 + "\" " + string.Join(" ", args);
        ProcessStartInfo psi = new ProcessStartInfo("powershell.exe", argList) {
            UseShellExecute = false
        };
        Process p = Process.Start(psi);
        p.WaitForExit();
        return p.ExitCode;
    }
}
"@
    $csFile = "$InstallDir\ray.cs"
    Set-Content -Path $csFile -Value $csharpCode -Encoding UTF8
    & $csc /nologo /optimize /target:exe /out:"$ExePath" "$csFile" | Out-Null
    if (Test-Path $csFile) { Remove-Item $csFile -Force }
}

# 5. Add to user PATH permanently if not already present
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($UserPath -notmatch [regex]::Escape($InstallDir)) {
    $NewPath = if ($UserPath -and !$UserPath.EndsWith(";")) { "$UserPath;$InstallDir" } else { "$UserPath$InstallDir" }
    [Environment]::SetEnvironmentVariable("Path", $NewPath, "User")
    $env:Path = "$env:Path;$InstallDir"
    Write-Host "Added $InstallDir to PATH" -ForegroundColor Gray
}

Write-Host "`nok: Ray installed successfully in <1 second! Type 'ray' to start." -ForegroundColor Green
