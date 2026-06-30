# Lume shell integration (OSC 133) — PowerShell
#
# Dot-source this file from your PowerShell profile ($PROFILE), e.g.:
#   if ($env:LUME_TERM) { . "$env:APPDATA\lume\lume-shell-init.ps1" }
#
# Emits the same FinalTerm shell-integration markers (OSC 133) as Lume's
# bash/zsh scripts so the app can detect command boundaries, exit codes, the
# current directory (OSC 7) and the alias list (OSC 7733). Works on both Windows
# PowerShell 5.1 and PowerShell 7+ ([char]27/[char]7 instead of the `e escape,
# which 5.1 lacks).

if (-not $env:LUME_TERM) { return }
if ($Global:__LumeShellInitLoaded) { return }
$Global:__LumeShellInitLoaded = $true

$Global:__LumeHasPrevious = $false
$Global:__LumeAliasesSent = $false

# Preserve any existing prompt (custom prompt, oh-my-posh, etc.) so we wrap it
# instead of replacing it — mirrors how the bash/zsh scripts append to PS1.
if (Test-Path Function:\prompt) {
    $Global:__LumeOriginalPrompt = $Function:prompt
}

# OSC 7733: base64 of "name<TAB>value" rows, so the autocomplete can suggest
# the user's aliases. Emitted once, from the first prompt.
function Global:__LumeAliasPayload {
    $esc = [char]27; $bel = [char]7
    $sb = [System.Text.StringBuilder]::new()
    foreach ($a in Get-Alias) {
        # Flatten whitespace so it can't split our row format.
        $def = ($a.Definition -replace "[`r`n`t]", ' ')
        [void]$sb.Append($a.Name)
        [void]$sb.Append([char]9)   # TAB
        [void]$sb.Append($def)
        [void]$sb.Append([char]10)  # LF
    }
    $payload = $sb.ToString()
    if ($payload.Length -eq 0) { return '' }
    $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($payload))
    return "$esc]7733;$b64$bel"
}

function Global:prompt {
    # Capture command status *first*, before anything below clobbers it.
    $ok = $?
    $gle = $global:LASTEXITCODE
    $esc = [char]27; $bel = [char]7
    $out = ''

    # D — previous command finished, with its exit code.
    if ($Global:__LumeHasPrevious) {
        $code = if ($ok) { 0 } elseif ($null -ne $gle) { $gle } else { 1 }
        $out += "$esc]133;D;$code$bel"
    }

    # A — prompt start.
    $out += "$esc]133;A$bel"

    # OSC 7 — current directory (filesystem locations only).
    if ($PWD.Provider.Name -eq 'FileSystem') {
        $p = ($PWD.ProviderPath -replace '\\', '/')
        $out += "$esc]7;file://$env:COMPUTERNAME/$p$bel"
    }

    if (-not $Global:__LumeAliasesSent) {
        $Global:__LumeAliasesSent = $true
        $out += (__LumeAliasPayload)
    }

    # The user's (wrapped) prompt, or a sensible default.
    if ($Global:__LumeOriginalPrompt) {
        $out += [string](& $Global:__LumeOriginalPrompt)
    } else {
        $out += "PS $($PWD.Path)> "
    }

    # B — end of prompt / start of the command line (autocomplete anchor).
    $out += "$esc]133;B$bel"

    $Global:__LumeHasPrevious = $true
    # Restore $LASTEXITCODE so our bookkeeping is invisible to the user.
    $global:LASTEXITCODE = $gle
    return $out
}

# C (output start) + E (command line) are emitted right before a command runs,
# via the PSReadLine Enter handler. Degrades gracefully when PSReadLine is absent
# (markers just won't fire — the terminal still works).
if (Get-Command Set-PSReadLineKeyHandler -ErrorAction SilentlyContinue) {
    Set-PSReadLineKeyHandler -Key Enter -ScriptBlock {
        $line = $null; $cursor = $null
        [Microsoft.PowerShell.PSConsoleReadLine]::GetBufferState([ref]$line, [ref]$cursor)
        $esc = [char]27; $bel = [char]7
        [Console]::Write("$esc]133;C$bel")
        if ($line) { [Console]::Write("$esc]133;E;$line$bel") }
        [Microsoft.PowerShell.PSConsoleReadLine]::AcceptLine()
    }
}
