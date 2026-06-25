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
  local code=$?
  if [[ -n "$__LUME_HAS_PREVIOUS" ]]; then
    printf '\e]133;D;%s\a' "$code"
  fi
  printf '\e]133;A\a'
  printf '\e]7;file://%s%s\a' "$HOSTNAME" "$PWD"
  __LUME_HAS_PREVIOUS=1
  __LUME_PREEXEC_FIRED=
  __LUME_IN_PROMPT=
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
  printf '\e]133;E;%s\a' "$BASH_COMMAND"
}

# Set the prompt guard before our hook so DEBUG can detect it.
PS0='${__LUME_IN_PROMPT:=}'
PROMPT_COMMAND="__LUME_IN_PROMPT=1; __lume_pre_prompt${PROMPT_COMMAND:+; $PROMPT_COMMAND}"
trap '__lume_pre_exec' DEBUG

# OSC 133;B marks the end of the prompt / start of the command line. Lume reads
# the cursor column at this point as the anchor for inline autocomplete. We
# append it once to PS1 (wrapped in \[ \] so bash doesn't count it in the prompt
# width). NB: prompts rebuilt dynamically on every render (e.g. starship) drop
# this suffix — autocomplete then degrades gracefully (no suggestions).
PS1="${PS1}\[\e]133;B\a\]"
