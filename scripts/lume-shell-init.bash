# Lume shell integration (OSC 133) — bash
#
# Source this file from your ~/.bashrc, e.g.:
#   [[ -n "$LUME_TERM" ]] && source /path/to/lume/scripts/lume-shell-init.bash
#
# This emits FinalTerm shell-integration markers (OSC 133) that Lume parses
# to detect command boundaries and exit codes. A DEBUG trap stands in for the
# preexec hook bash lacks natively.

if [[ -z "$LUME_TERM" ]]; then
  return 0
fi

if [[ -n "$__LUME_SHELL_INIT_LOADED" ]]; then
  return 0
fi
__LUME_SHELL_INIT_LOADED=1

# Emit the alias list to Lume (OSC 7733: base64 of "name<TAB>value" rows) so the
# autocomplete can suggest the user's aliases. We parse `alias` output
# (`alias name='value'`).
__lume_send_aliases() {
  local payload="" line name val
  while IFS= read -r line; do
    line="${line#alias }"
    name="${line%%=*}"
    val="${line#*=}"
    val="${val#\'}"; val="${val%\'}"
    [[ -n "$name" ]] && payload+="${name}"$'\t'"${val}"$'\n'
  done < <(alias 2>/dev/null)
  [[ -n "$payload" ]] && \
    printf '\e]7733;%s\a' "$(printf '%s' "$payload" | base64 | tr -d '\n')"
}

__lume_pre_prompt() {
  # $? was captured into __LUME_LAST_STATUS as the FIRST statement of
  # PROMPT_COMMAND: any assignment or command run before reading it (the
  # previous version set __LUME_IN_PROMPT=1 first) resets $? to 0, which made
  # every block show exit 0.
  local code=${__LUME_LAST_STATUS:-0}
  if [[ -n "$__LUME_HAS_PREVIOUS" ]]; then
    printf '\e]133;D;%s\a' "$code"
  fi
  printf '\e]133;A\a'
  printf '\e]7;file://%s%s\a' "$HOSTNAME" "$PWD"
  __LUME_HAS_PREVIOUS=1
  __LUME_PREEXEC_FIRED=
  __LUME_IN_PROMPT=
  # Remember the last history number: preexec uses it to tell whether the
  # command being run was actually appended to history (HISTCONTROL may skip
  # it, e.g. ignorespace) before trusting `history 1` for the command line.
  __LUME_HIST_AT_PROMPT=$(HISTTIMEFORMAT= builtin history 1 2>/dev/null)
  if [[ $__LUME_HIST_AT_PROMPT =~ ^[[:space:]]*([0-9]+) ]]; then
    __LUME_HIST_AT_PROMPT=${BASH_REMATCH[1]}
  else
    __LUME_HIST_AT_PROMPT=
  fi
  if [[ -z "$__LUME_ALIASES_SENT" ]]; then
    __LUME_ALIASES_SENT=1
    __lume_send_aliases
  fi
}

__lume_pre_exec() {
  # Suppress the trap for commands fired by PROMPT_COMMAND and for repeated
  # DEBUG firings on the same input line (compound commands fire multiple times).
  if [[ -n "$__LUME_IN_PROMPT" || -n "$__LUME_PREEXEC_FIRED" ]]; then
    return
  fi
  __LUME_PREEXEC_FIRED=1
  printf '\e]133;C\a'
  # $BASH_COMMAND only holds the FIRST simple command of a compound line
  # ("sleep 3 && echo ok" → "sleep 3"). The freshly-appended history entry has
  # the line as typed — use it when it exists (same approach as bash-preexec),
  # and fall back to $BASH_COMMAND when history didn't record the command
  # (history off, HISTCONTROL=ignorespace…), detected via the entry number
  # saved at prompt time.
  local cmd hist num
  hist=$(HISTTIMEFORMAT= builtin history 1 2>/dev/null)
  if [[ $hist =~ ^[[:space:]]*([0-9]+)\*?[[:space:]][[:space:]]?(.*)$ ]]; then
    num=${BASH_REMATCH[1]}
    cmd=${BASH_REMATCH[2]}
  fi
  if [[ -z "$cmd" || "$num" == "$__LUME_HIST_AT_PROMPT" ]]; then
    cmd=$BASH_COMMAND
  fi
  printf '\e]133;E;%s\a' "$cmd"
}

# Set the prompt guard before our hook so DEBUG can detect it. The $? capture
# MUST stay the first statement — everything after it clobbers $?.
PS0='${__LUME_IN_PROMPT:=}'
PROMPT_COMMAND="__LUME_LAST_STATUS=\$?; __LUME_IN_PROMPT=1; __lume_pre_prompt${PROMPT_COMMAND:+; $PROMPT_COMMAND}"

# OSC 133;B marks the end of the prompt / start of the command line. Lume reads
# the cursor column at this point as the anchor for inline autocomplete. We
# append it once to PS1 (wrapped in \[ \] so bash doesn't count it in the prompt
# width). NB: prompts rebuilt dynamically on every render (e.g. starship) drop
# this suffix — autocomplete then degrades gracefully (no suggestions).
PS1="${PS1}\[\e]133;B\a\]"

# Registered LAST so the DEBUG trap doesn't fire on this script's own tail
# statements while it's being sourced. The guard is pre-armed so the FIRST
# PROMPT_COMMAND run (before any typed command — PS0 hasn't cleared it yet)
# is suppressed too: without it the trap fires there and `history 1` names a
# command from the loaded history file (spurious 133;C/E before first prompt).
__LUME_IN_PROMPT=1
trap '__lume_pre_exec' DEBUG
