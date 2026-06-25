/**
 * Tiny regex-based syntax highlighter for the languages most likely to show up
 * in Claude responses inside a terminal app: shell/bash, JavaScript/TypeScript,
 * Rust, and a JSON/TOML-ish fallback.
 *
 * Not a real lexer — it's good enough to make a code block visually parsable
 * inside the AI panel. For something proper, plug in Prism or Shiki later.
 */

export type TokenType =
  | "text"
  | "comment"
  | "string"
  | "number"
  | "keyword"
  | "command"
  | "variable"
  | "flag"
  | "operator"
  | "function"
  | "type"
  | "punctuation";

export type Token = { type: TokenType; value: string };

type Rule = { type: TokenType; re: RegExp };

// Helper: build a sticky regex from a source.
const sticky = (src: string) => new RegExp(src, "y");

const SHELL_KEYWORDS = new Set([
  "if", "then", "else", "elif", "fi", "case", "esac", "for", "while", "do",
  "done", "in", "function", "return", "exit", "export", "local", "readonly",
  "unset", "shift", "set", "trap", "break", "continue",
]);

const SHELL_COMMANDS = new Set([
  "ls", "cd", "pwd", "echo", "printf", "cat", "head", "tail", "less", "more",
  "grep", "rg", "ag", "find", "fd", "sed", "awk", "cut", "sort", "uniq", "wc",
  "tr", "xargs", "cp", "mv", "rm", "mkdir", "rmdir", "touch", "ln", "chmod",
  "chown", "ps", "kill", "killall", "top", "htop", "df", "du", "free",
  "git", "docker", "kubectl", "npm", "pnpm", "yarn", "node", "deno", "bun",
  "cargo", "rustc", "rustup", "python", "pip", "ruby", "gem", "go", "java",
  "make", "cmake", "ninja", "ssh", "scp", "rsync", "curl", "wget", "tar",
  "zip", "unzip", "gzip", "gunzip", "which", "whereis", "type", "alias",
  "test", "true", "false", "tee", "yes", "watch", "tmux", "screen",
  "claude",
]);

const JS_KEYWORDS = new Set([
  "var", "let", "const", "function", "return", "if", "else", "while", "for",
  "do", "switch", "case", "break", "continue", "default", "throw", "try",
  "catch", "finally", "new", "delete", "typeof", "instanceof", "in", "of",
  "void", "yield", "await", "async", "class", "extends", "super", "this",
  "static", "public", "private", "protected", "interface", "type", "enum",
  "implements", "import", "export", "from", "as", "true", "false", "null",
  "undefined", "Infinity", "NaN",
]);

const RUST_KEYWORDS = new Set([
  "fn", "let", "mut", "const", "static", "pub", "use", "mod", "crate",
  "extern", "as", "in", "if", "else", "while", "for", "loop", "match",
  "break", "continue", "return", "struct", "enum", "trait", "impl", "type",
  "where", "self", "Self", "super", "ref", "move", "dyn", "async", "await",
  "true", "false", "unsafe", "box",
]);

function tokenizeShell(src: string): Token[] {
  const rules: Rule[] = [
    { type: "comment", re: sticky("#[^\\n]*") },
    { type: "string", re: sticky("\"(?:\\\\.|[^\"\\\\])*\"") },
    { type: "string", re: sticky("'(?:[^'])*'") },
    { type: "variable", re: sticky("\\$\\{[^}]+\\}|\\$[A-Za-z_][A-Za-z0-9_]*|\\$\\?|\\$@|\\$#|\\$\\*|\\$\\$") },
    { type: "flag", re: sticky("(?<=^|\\s)--?[A-Za-z][\\w-]*") },
    { type: "number", re: sticky("\\b\\d+(?:\\.\\d+)?\\b") },
    { type: "operator", re: sticky("&&|\\|\\||==|!=|<=|>=|<<|>>|[|&;<>=!]") },
  ];
  return tokenize(src, rules, (word, prev) => {
    if (SHELL_KEYWORDS.has(word)) return "keyword";
    // First non-whitespace token of a logical command position is a "command".
    if (
      SHELL_COMMANDS.has(word) ||
      prev === null ||
      prev === "|" ||
      prev === "&&" ||
      prev === "||" ||
      prev === ";"
    ) {
      return "command";
    }
    return null;
  });
}

function tokenizeJS(src: string): Token[] {
  const rules: Rule[] = [
    { type: "comment", re: sticky("//[^\\n]*") },
    { type: "comment", re: sticky("/\\*[\\s\\S]*?\\*/") },
    { type: "string", re: sticky("\"(?:\\\\.|[^\"\\\\])*\"") },
    { type: "string", re: sticky("'(?:\\\\.|[^'\\\\])*'") },
    { type: "string", re: sticky("`(?:\\\\.|[^`\\\\])*`") },
    { type: "number", re: sticky("\\b\\d+(?:\\.\\d+)?\\b") },
    { type: "operator", re: sticky("=>|\\+\\+|--|==|!=|<=|>=|&&|\\|\\||[+\\-*/%=<>!]") },
    { type: "punctuation", re: sticky("[{}\\[\\]();,]") },
  ];
  return tokenize(src, rules, (word) => {
    if (JS_KEYWORDS.has(word)) return "keyword";
    // Heuristic: PascalCase = type
    if (/^[A-Z][A-Za-z0-9]*$/.test(word)) return "type";
    return null;
  });
}

function tokenizeRust(src: string): Token[] {
  const rules: Rule[] = [
    { type: "comment", re: sticky("//[^\\n]*") },
    { type: "comment", re: sticky("/\\*[\\s\\S]*?\\*/") },
    { type: "string", re: sticky("\"(?:\\\\.|[^\"\\\\])*\"") },
    { type: "string", re: sticky("'(?:\\\\.|[^'\\\\])'") },
    { type: "number", re: sticky("\\b\\d+(?:\\.\\d+)?(?:_\\d+)*(?:[ui](?:8|16|32|64|128|size)|f(?:32|64))?\\b") },
    { type: "variable", re: sticky("'[a-z_][A-Za-z0-9_]*\\b") }, // lifetimes
    { type: "operator", re: sticky("->|::|=>|\\.\\.|==|!=|<=|>=|&&|\\|\\||[+\\-*/%=<>!&|]") },
    { type: "punctuation", re: sticky("[{}\\[\\]();,?]") },
  ];
  return tokenize(src, rules, (word) => {
    if (RUST_KEYWORDS.has(word)) return "keyword";
    if (/^[A-Z][A-Za-z0-9_]*$/.test(word)) return "type";
    return null;
  });
}

/**
 * Generic tokenize loop. Tries each rule (sticky) at the current position.
 * Identifiers are extracted by default and resolved through `wordResolver`.
 * Anything that didn't match falls into "text".
 */
function tokenize(
  src: string,
  rules: Rule[],
  wordResolver: (word: string, prev: string | null) => TokenType | null
): Token[] {
  const out: Token[] = [];
  let i = 0;
  let prevSignif: string | null = null;
  const pushText = (v: string) => {
    if (!v) return;
    const last = out[out.length - 1];
    if (last && last.type === "text") last.value += v;
    else out.push({ type: "text", value: v });
  };

  while (i < src.length) {
    // Whitespace
    if (/\s/.test(src[i])) {
      let end = i + 1;
      while (end < src.length && /\s/.test(src[end])) end++;
      pushText(src.slice(i, end));
      i = end;
      continue;
    }

    let matched = false;
    for (const rule of rules) {
      rule.re.lastIndex = i;
      const m = rule.re.exec(src);
      if (m && m.index === i) {
        out.push({ type: rule.type, value: m[0] });
        if (rule.type === "operator" || rule.type === "punctuation") {
          prevSignif = m[0];
        }
        i += m[0].length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Identifier or word
    const wordMatch = /[A-Za-z_][A-Za-z0-9_-]*/y;
    wordMatch.lastIndex = i;
    const wm = wordMatch.exec(src);
    if (wm && wm.index === i) {
      const word = wm[0];
      const tt = wordResolver(word, prevSignif);
      if (tt) {
        out.push({ type: tt, value: word });
      } else {
        pushText(word);
      }
      prevSignif = word;
      i += word.length;
      continue;
    }

    // Anything else: single char as text.
    pushText(src[i]);
    i++;
  }
  return out;
}

const LANG_ALIASES: Record<string, string> = {
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  fish: "shell",
  shell: "shell",
  console: "shell",
  js: "js",
  javascript: "js",
  ts: "js",
  typescript: "js",
  jsx: "js",
  tsx: "js",
  rust: "rust",
  rs: "rust",
};

export function highlight(src: string, lang: string): Token[] {
  const norm = LANG_ALIASES[lang.toLowerCase().trim()] ?? "";
  switch (norm) {
    case "shell":
      return tokenizeShell(src);
    case "js":
      return tokenizeJS(src);
    case "rust":
      return tokenizeRust(src);
    default:
      return [{ type: "text", value: src }];
  }
}
