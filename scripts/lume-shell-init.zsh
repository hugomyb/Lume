# Lume shell integration (OSC 133) — zsh
#
# Source this file from your ~/.zshrc, e.g.:
#   [[ -n "$LUME_TERM" ]] && source /path/to/lume/scripts/lume-shell-init.zsh
#
# This emits FinalTerm/iTerm2 shell-integration markers (OSC 133) that Lume
# parses to detect command boundaries and exit codes.

if [[ -z "$LUME_TERM" ]]; then
  return 0
fi

# Reentry guard
if [[ -n "$__LUME_SHELL_INIT_LOADED" ]]; then
  return 0
fi
__LUME_SHELL_INIT_LOADED=1

autoload -Uz add-zsh-hook

# Emit the alias list to Lume (OSC 7733: base64 of "name<TAB>value" rows) so the
# autocomplete can suggest the user's aliases. `aliases` is zsh's builtin
# name→value map; ${(k)aliases} are its keys.
__lume_send_aliases() {
  local payload="" k
  for k in ${(k)aliases}; do
    # Flatten any newline in the value so it can't split our row format.
    payload+="${k}"$'\t'"${aliases[$k]//$'\n'/ }"$'\n'
  done
  [[ -n "$payload" ]] && \
    printf '\e]7733;%s\a' "$(printf '%s' "$payload" | base64 | tr -d '\n')"
}

__lume_precmd() {
  local code=$?
  if [[ -n "$__LUME_HAS_PREVIOUS" ]]; then
    print -nP "\e]133;D;${code}\a"
  fi
  print -nP "\e]133;A\a"
  # OSC 7 — let Lume know our cwd so the IA palette can give precise commands.
  printf '\e]7;file://%s%s\a' "$HOST" "$PWD"
  __LUME_HAS_PREVIOUS=1
  # Send aliases once, from the first prompt — not during sourcing, so we don't
  # trip Powerlevel10k's "console output during instant prompt" warning.
  if [[ -z "$__LUME_ALIASES_SENT" ]]; then
    __LUME_ALIASES_SENT=1
    __lume_send_aliases
  fi
}

__lume_preexec() {
  # $1 is the full command line as typed (preserved by zsh, including history expansion)
  print -nP "\e]133;C\a"
  print -nr -- $'\e]133;E;'"$1"$'\a'
}

add-zsh-hook precmd __lume_precmd
add-zsh-hook preexec __lume_preexec

# OSC 133;B marks the end of the prompt / start of the command line. Lume reads
# the cursor column here as the anchor for inline autocomplete. Wrapped in
# %{ %} so zsh treats it as zero-width when computing the prompt layout.
PS1="${PS1}%{"$'\e]133;B\a'"%}"
