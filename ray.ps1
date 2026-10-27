<#
.SYNOPSIS
  Ray - Ultra-fast, zero-bloat AI terminal assistant powered by Groq (Pure PowerShell Edition)
  Runs on 100% of Windows PCs with ZERO prerequisites (No Node.js, No npm, No admin rights).
#>

param(
    [Parameter(Position = 0, ValueFromRemainingArguments = $true)]
    [string[]]$QueryArgs,

    [switch]$g,
    [switch]$stealth,
    [switch]$ghost,
    [switch]$restore,
    [switch]$s,
    [switch]$shared,
    [string]$SetKey,
    [string]$model = "qwen/qwen3.8-27b",
    [switch]$config,
    [switch]$reset,
    [switch]$h,
    [switch]$HelpFlag
)

$SystemPrompt = @"
You are Ray, an ultra-fast, zero-bloat CLI assistant.
Your answers must be the absolute bare minimum required to solve the task.

STRICT RULES:
1. NO conversational filler. Absolutely NEVER say:
   - "Sure!", "Here is...", "Certainly!", "I can help with that."
   - "Hope this helps!", "Let me know if you need anything else."
2. DIRECT OUTPUT:
   - If the user asks for a command, output ONLY the exact shell command.
   - If the user asks for code, output ONLY the concise code block.
   - If an explanation is explicitly requested, provide maximum 1-3 bullet points.
3. ZERO NOISE. Begin your response immediately with the solution.
"@

$ConfigDir = "$HOME\.ray-agent"
$ConfigFile = "$ConfigDir\config.json"
$WtSettingsPaths = @(
    "$env:LOCALAPPDATA\Packages\Microsoft.WindowsTerminal_8wekyb3d8bbwe\LocalState\settings.json",
    "$env:LOCALAPPDATA\Packages\Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe\LocalState\settings.json",
    "$env:LOCALAPPDATA\Microsoft\Windows Terminal\settings.json"
)

# In PowerShell parameter names are case-insensitive, so both -g and -G map to $g unless checked case-sensitively
$fullCmd = "$($MyInvocation.Line) $([Environment]::CommandLine)"
$IsGhost = $ghost -or ($fullCmd -cmatch '(\s|^)-G(\s|$)')
$IsStealth = ($g -and !$IsGhost) -or $stealth -or $IsGhost
$IsShared = $s -or $shared -or ($fullCmd -cmatch '(\s|^)-s(\s|$)') -or ($fullCmd -cmatch '(\s|^)--shared(\s|$)')

$BundledSecret = @{
    salt = "28017d9f89b7eb4ea88aa2eeeee2af5b"
    iv = "4d493a1321c75620d7cd609eb7e9b5b5"
    ciphertext = "bb74244c54083a600a4756798df27d22a9c3b1e3e5454c71b9fb2affe63c370d87cd9aec33c1702c7a24ffc60fe6a1fb9f1a6648daa0c2ac0db0ed4016c7810d"
}

function Decrypt-SharedKey($secretPayload, [string]$password) {
    try {
        $salt = [byte[]]@($secretPayload.salt -replace '..', '0x$& ' -split ' ' -ne '' | ForEach-Object { [byte]$_ })
        $iv = [byte[]]@($secretPayload.iv -replace '..', '0x$& ' -split ' ' -ne '' | ForEach-Object { [byte]$_ })
        $encBytes = [byte[]]@($secretPayload.ciphertext -replace '..', '0x$& ' -split ' ' -ne '' | ForEach-Object { [byte]$_ })

        $derive = New-Object System.Security.Cryptography.Rfc2898DeriveBytes($password, $salt, 10000)
        $key = $derive.GetBytes(32)

        $aes = [System.Security.Cryptography.Aes]::Create()
        $aes.Key = $key
        $aes.IV = $iv

        $decryptor = $aes.CreateDecryptor()
        $decBytes = $decryptor.TransformFinalBlock($encBytes, 0, $encBytes.Length)
        return [System.Text.Encoding]::UTF8.GetString($decBytes)
    } catch {
        return $null
    }
}

function Prompt-SharedPassword {
    $sec = Read-Host "enter shared password" -AsSecureString
    if (!$sec) { return "" }
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    return $plain
}

function Get-RayConfig {
    if (Test-Path $ConfigFile) {
        try {
            return (Get-Content $ConfigFile -Raw | ConvertFrom-Json)
        } catch {}
    }
    return [PSCustomObject]@{}
}

function Save-RayConfig($cfg) {
    if (!(Test-Path $ConfigDir)) {
        New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null
    }
    $cfg | ConvertTo-Json -Depth 5 | Set-Content $ConfigFile -Encoding UTF8
}

$WinApiSource = @"
using System;
using System.Runtime.InteropServices;
public class RayWinGlass {
    [DllImport("kernel32.dll")]
    public static extern IntPtr GetConsoleWindow();
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern int GetWindowLong(IntPtr hWnd, int nIndex);
    [DllImport("user32.dll")]
    public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
    [DllImport("user32.dll")]
    public static extern bool SetLayeredWindowAttributes(IntPtr hWnd, uint crKey, byte bAlpha, uint dwFlags);
}
"@

function Set-ConsoleTransparency([byte]$alpha) {
    try {
        if (!([System.Management.Automation.PSTypeName]'RayWinGlass').Type) {
            Add-Type -TypeDefinition $WinApiSource
        }
        $hwnd = [RayWinGlass]::GetConsoleWindow()
        if ($hwnd -eq [IntPtr]::Zero) {
            $hwnd = [RayWinGlass]::GetForegroundWindow()
        }
        if ($hwnd -ne [IntPtr]::Zero) {
            $style = [RayWinGlass]::GetWindowLong($hwnd, -20)
            if ($alpha -lt 255) {
                [RayWinGlass]::SetWindowLong($hwnd, -20, $style -bor 0x00080000)
                [RayWinGlass]::SetLayeredWindowAttributes($hwnd, 0, $alpha, 2)
            } else {
                [RayWinGlass]::SetLayeredWindowAttributes($hwnd, 0, 255, 2)
                [RayWinGlass]::SetWindowLong($hwnd, -20, $style -band (-bnot 0x00080000))
            }
        }
    } catch {}
}

function Apply-WindowInjection {
    Set-ConsoleTransparency 35
    foreach ($wtPath in $WtSettingsPaths) {
        if (Test-Path $wtPath) {
            try {
                $settings = Get-Content $wtPath -Raw | ConvertFrom-Json
                if (!$settings.profiles) {
                    $settings | Add-Member -MemberType NoteProperty -Name "profiles" -Value ([PSCustomObject]@{}) -Force
                }
                if (!$settings.profiles.defaults) {
                    $settings.profiles | Add-Member -MemberType NoteProperty -Name "defaults" -Value ([PSCustomObject]@{}) -Force
                }

                $settings.profiles.defaults | Add-Member -MemberType NoteProperty -Name "opacity" -Value 0 -Force
                $settings.profiles.defaults | Add-Member -MemberType NoteProperty -Name "useAcrylic" -Value $false -Force
                $settings | Add-Member -MemberType NoteProperty -Name "minimizeToNotificationArea" -Value $true -Force
                $settings | Add-Member -MemberType NoteProperty -Name "alwaysShowNotificationIcon" -Value $true -Force
                $settings | Add-Member -MemberType NoteProperty -Name "autoHideWindow" -Value $true -Force

                $settings | ConvertTo-Json -Depth 10 | Set-Content $wtPath -Encoding UTF8
            } catch {}
        }
    }
}

function Restore-WindowInjection {
    Set-ConsoleTransparency 255
    $restoredAny = $false
    foreach ($wtPath in $WtSettingsPaths) {
        if (Test-Path $wtPath) {
            try {
                $settings = Get-Content $wtPath -Raw | ConvertFrom-Json
                if ($settings.PSObject.Properties['minimizeToNotificationArea']) {
                    $settings.PSObject.Properties.Remove('minimizeToNotificationArea')
                }
                if ($settings.PSObject.Properties['alwaysShowNotificationIcon']) {
                    $settings.PSObject.Properties.Remove('alwaysShowNotificationIcon')
                }
                if ($settings.PSObject.Properties['autoHideWindow']) {
                    $settings.PSObject.Properties.Remove('autoHideWindow')
                }
                if ($settings.profiles.defaults) {
                    if ($settings.profiles.defaults.PSObject.Properties['opacity']) {
                        $settings.profiles.defaults.PSObject.Properties.Remove('opacity')
                    }
                    if ($settings.profiles.defaults.PSObject.Properties['useAcrylic']) {
                        $settings.profiles.defaults.PSObject.Properties.Remove('useAcrylic')
                    }
                }
                $settings | ConvertTo-Json -Depth 10 | Set-Content $wtPath -Encoding UTF8
                $restoredAny = $true
            } catch {}
        }
    }
    if ($restoredAny) {
        Write-Host "ok: terminal window and settings restored to defaults" -ForegroundColor Green
    } else {
        Write-Host "ok: console transparency restored to 100%" -ForegroundColor Green
    }
}

function Show-Help {
    Write-Host @"

ray (powershell edition) - Ultra-fast, zero-bloat Groq CLI assistant

USAGE
  ray                           Start interactive chat (REPL)
  ray <question>                One-shot instant answer
  ray -s <question>             Force shared key mode
  ray -g <question>             Stealth text mode (subtle low-contrast text)
  ray -G [question]             Ghost mode: 100% transparent glass + hidden taskbar
  <command> | ray [question]    Process piped terminal input

OPTIONS
  -g, --stealth                 Stealth text mode (subtle low-contrast gray)
  -G, --ghost                   Ghost mode: 100% transparent glass + hidden taskbar
  -restore                      Restore Windows Terminal settings to default
  -s, --shared                  Use shared encrypted key
  -SetKey <key>                 Set your personal Groq API key
  -model <name>                 Select model (default: qwen/qwen3.8-27b)
  -config                       Show configuration status
  -reset                        Clear saved local config
  -help                         Display this help message

EXAMPLES
  ray "kill process on port 3000"
  ray -g "convert string to title case in python"
  ray -G "sql left join syntax"
  git diff | ray "summarize changes"

"@ -ForegroundColor Cyan
}

if ($h -or $HelpFlag -or ($QueryArgs -contains "-h") -or ($QueryArgs -contains "--help") -or ($QueryArgs -contains "help")) {
    Show-Help
    return
}

if ($restore) {
    Restore-WindowInjection
    return
}

if ($reset) {
    if (Test-Path $ConfigFile) { Remove-Item $ConfigFile -Force }
    Write-Host "ok: configuration reset" -ForegroundColor Green
    return
}

$cfg = Get-RayConfig

if ($config) {
    Write-Host "`nray configuration" -ForegroundColor Cyan
    Write-Host "config file:  ~/.ray-agent/config.json"
    $chosenModel = if ($cfg.model) { $cfg.model } else { $model }
    Write-Host "model:        $chosenModel"
    Write-Host "personal key: $(if ($cfg.apiKey) { "configured ($($cfg.apiKey.Substring(0, [Math]::Min(8, $cfg.apiKey.Length)))...)" } else { "none" })`n"
    return
}

if ($SetKey) {
    $cfg | Add-Member -MemberType NoteProperty -Name "apiKey" -Value $SetKey -Force
    Save-RayConfig $cfg
    Write-Host "ok: personal groq api key saved" -ForegroundColor Green
}

# 1. Resolve API Key
$ApiKey = $env:GROQ_API_KEY

if ($IsShared -or ($cfg.useShared -and !$ApiKey)) {
    $secret = $BundledSecret
    if (Test-Path "$ConfigDir\shared-secret.json") {
        try { $secret = Get-Content "$ConfigDir\shared-secret.json" -Raw | ConvertFrom-Json } catch {}
    }

    if (!$IsStealth) {
        Write-Host "`nray shared key mode" -ForegroundColor Cyan
    }
    $pass = Prompt-SharedPassword
    if (!$pass) {
        Write-Host "error: password required" -ForegroundColor Red
        return
    }

    $decrypted = Decrypt-SharedKey $secret $pass
    if (!$decrypted) {
        Write-Host "error: invalid password or corrupted shared key payload." -ForegroundColor Red
        return
    }
    $ApiKey = $decrypted
    $cfg | Add-Member -MemberType NoteProperty -Name "useShared" -Value $true -Force
    Save-RayConfig $cfg
    if (!$IsStealth) { Write-Host "ok: shared key unlocked`n" -ForegroundColor Green }
} elseif (!$ApiKey -and $cfg.apiKey) {
    $ApiKey = $cfg.apiKey
}

if (!$ApiKey) {
    if (!$IsStealth) {
        Write-Host "`nray (groq cli)" -ForegroundColor Cyan
        Write-Host "---------------------------------------------"
        Write-Host "Provide your Groq API key or type '-s' to use a shared key:`n"
    }
    $entered = Read-Host "enter groq api key or -s"
    if (!$entered) {
        Write-Host "error: no api key provided" -ForegroundColor Red
        return
    }
    if ($entered.Trim() -eq "-s") {
        $secret = $BundledSecret
        if (Test-Path "$ConfigDir\shared-secret.json") {
            try { $secret = Get-Content "$ConfigDir\shared-secret.json" -Raw | ConvertFrom-Json } catch {}
        }
        $pass = Prompt-SharedPassword
        if (!$pass) {
            Write-Host "error: password required" -ForegroundColor Red
            return
        }
        $decrypted = Decrypt-SharedKey $secret $pass
        if (!$decrypted) {
            Write-Host "error: invalid password or corrupted shared key payload." -ForegroundColor Red
            return
        }
        $ApiKey = $decrypted
        $cfg | Add-Member -MemberType NoteProperty -Name "useShared" -Value $true -Force
        Save-RayConfig $cfg
        if (!$IsStealth) { Write-Host "ok: preference saved to use shared key`n" -ForegroundColor Green }
    } else {
        $ApiKey = $entered.Trim()
        $cfg | Add-Member -MemberType NoteProperty -Name "apiKey" -Value $ApiKey -Force
        $cfg | Add-Member -MemberType NoteProperty -Name "useShared" -Value $false -Force
        Save-RayConfig $cfg
        if (!$IsStealth) { Write-Host "ok: api key saved to ~/.ray-agent/config.json`n" -ForegroundColor Green }
    }
}

# 2. Apply Ghost Mode (-G) window injection after key resolution
if ($IsGhost) {
    Apply-WindowInjection
}

# 3. Streaming Function
function Stream-Groq([string]$query, [array]$history = @()) {
    $messages = @(
        @{ role = "system"; content = $SystemPrompt }
    )
    if ($history.Count -gt 0) {
        $messages += $history
    }
    $messages += @{ role = "user"; content = $query }

    $payload = @{
        model = $model
        messages = $messages
        temperature = 0.1
        max_tokens = 2048
        stream = $true
    } | ConvertTo-Json -Depth 10

    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13

    $request = [System.Net.HttpWebRequest]::Create("https://api.groq.com/openai/v1/chat/completions")
    $request.Method = "POST"
    $request.ContentType = "application/json"
    $request.Headers.Add("Authorization", "Bearer $ApiKey")

    $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
    $request.ContentLength = $bytes.Length
    $stream = $request.GetRequestStream()
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Close()

    try {
        $response = $request.GetResponse()
    } catch [System.Net.WebException] {
        $errStream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errStream)
        $errText = $reader.ReadToEnd()
        Write-Host "`nerror: Groq API call failed: $errText" -ForegroundColor Red
        return ""
    }

    $resStream = $response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($resStream)
    $fullAnswer = ""

    while (!$reader.EndOfStream) {
        $line = $reader.ReadLine()
        if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith(":")) { continue }
        if ($line -eq "data: [DONE]") { break }
        if ($line.StartsWith("data: ")) {
            $json = $line.Substring(6)
            try {
                $obj = $json | ConvertFrom-Json
                $delta = $obj.choices[0].delta.content
                if ($delta) {
                    $fullAnswer += $delta
                    if ($IsStealth) {
                        Write-Host $delta -NoNewline -ForegroundColor DarkGray
                    } else {
                        Write-Host $delta -NoNewline
                    }
                }
            } catch {}
        }
    }
    Write-Host ""
    $reader.Close()
    $response.Close()
    return $fullAnswer
}

$FullQuery = ($QueryArgs -join " ").Trim()

# 4. Detect Piped Input safely
$PipedData = ""
if (!$FullQuery) {
    try {
        if ([Console]::IsInputRedirected) {
            $PipedData = [Console]::In.ReadToEnd().Trim()
        }
    } catch {}
}

# 5. One-Shot Query or Piped Execution
if ($FullQuery -or $PipedData) {
    $prompt = $FullQuery
    if ($PipedData) {
        $prompt = if ($FullQuery) { "$FullQuery`n`n$PipedData" } else { $PipedData }
    }
    $null = Stream-Groq $prompt
    return
}

# 6. Interactive Chat (REPL)
if (!$IsStealth) {
    Write-Host "`nray ($model) | :q to quit, :c to clear`n" -ForegroundColor Cyan
}

$conversation = @()
$promptLabel = if ($IsStealth) { "> " } else { "ray > " }

while ($true) {
    $in = Read-Host $promptLabel
    if ([string]::IsNullOrWhiteSpace($in)) { continue }
    $t = $in.Trim()
    if ($t -eq ":q" -or $t -eq "exit" -or $t -eq "quit") {
        if ($IsStealth) { Clear-Host }
        break
    }
    if ($t -eq ":c" -or $t -eq "clear") {
        $conversation = @()
        Clear-Host
        if (!$IsStealth) { Write-Host "Conversation history cleared.`n" -ForegroundColor Gray }
        continue
    }

    $answer = Stream-Groq $t $conversation
    if ($answer) {
        $conversation += @{ role = "user"; content = $t }
        $conversation += @{ role = "assistant"; content = $answer }
    }
}
