# Lume shell integration (OSC 133) — fish
#
# Source this from your ~/.config/fish/config.fish:
#   test -n "$LUME_TERM"; and source /path/to/lume/scripts/lume-shell-init.fish
#
# Emits FinalTerm OSC 133 markers + OSC 7 cwd so Lume can segment commands
# into blocks and give the IA palette precise context.

if not set -q LUME_TERM
    exit 0
end

if set -q __LUME_SHELL_INIT_LOADED
    exit 0
end
set -g __LUME_SHELL_INIT_LOADED 1

set -g __LUME_HAS_PREVIOUS 0

# Emit the alias list to Lume (OSC 7733: base64 of "name<TAB>value" rows) so the
# autocomplete can suggest the user's aliases. Best-effort parse of `alias`
# output (`alias name 'body'`).
function __lume_send_aliases
    set -l payload ""
    for line in (alias 2>/dev/null)
        set -l rest (string replace -r '^alias ' '' -- $line)
        set -l name (string replace -r ' .*$' '' -- $rest)
        set -l val (string replace -r '^[^ ]* ' '' -- $rest)
        set val (string trim -c '\'"' -- $val)
        test -n "$name"; and set payload "$payload$name"(printf '\t')"$val"(printf '\n')
    end
    test -n "$payload"; and printf '\e]7733;%s\a' (printf '%s' "$payload" | base64 | tr -d '\n')
end

function __lume_pre_prompt --on-event fish_prompt
    set -l code $status
    if test "$__LUME_HAS_PREVIOUS" = 1
        printf '\e]133;D;%s\a' "$code"
    end
    printf '\e]133;A\a'
    printf '\e]7;file://%s%s\a' (hostname) "$PWD"
    set -g __LUME_HAS_PREVIOUS 1
    if not set -q __LUME_ALIASES_SENT
        set -g __LUME_ALIASES_SENT 1
        __lume_send_aliases
    end
end

function __lume_preexec --on-event fish_preexec
    printf '\e]133;C\a'
    printf '\e]133;E;%s\a' "$argv"
end

# OSC 133;B marks the end of the prompt / start of the command line. Lume reads
# the cursor column here as the anchor for inline autocomplete. fish has no PS1,
# so we wrap the user's fish_prompt to emit B right after it paints. Source this
# file after fish_prompt is defined (i.e. at the end of config.fish).
if functions -q fish_prompt; and not functions -q __lume_orig_fish_prompt
    functions -c fish_prompt __lume_orig_fish_prompt
    function fish_prompt
        __lume_orig_fish_prompt
        printf '\e]133;B\a'
    end
end
