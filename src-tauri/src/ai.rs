use std::collections::HashMap;
use std::io::{BufRead, Read};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::thread;

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

use crate::config::{AiConfig, Config};
use crate::pty::{pty_cwd, PtyManager};

const MAX_OUTPUT_CHARS: usize = 8000;

#[derive(Default)]
pub struct AiManager {
    next_id: AtomicU64,
    /// Active CLI child processes, keyed by request id, for cancellation.
    children: Mutex<HashMap<u64, std::process::Child>>,
    /// Cancellation flags for in-flight API (HTTP streaming) requests.
    api_cancels: Mutex<HashMap<u64, Arc<AtomicBool>>>,
}

impl AiManager {
    pub fn new() -> Self {
        Self::default()
    }
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiStatus {
    pub available: bool,
    pub path: Option<String>,
    /// Active provider id ("claude" | "codex" | "custom").
    pub provider: String,
    /// The CLI command the active provider resolves to (for UI messages).
    pub command: String,
}

#[tauri::command]
pub fn ai_status(config: State<'_, Arc<Mutex<Config>>>) -> AiStatus {
    let ai = config.lock().ai.clone();
    if is_api_provider(&ai.provider) {
        let api = resolve_api(&ai);
        let available = !api.api_key.trim().is_empty()
            && !api.base_url.trim().is_empty()
            && !api.model.trim().is_empty();
        return AiStatus {
            available,
            path: None,
            provider: ai.provider,
            // Empty command → the palette shows the generic "configure a provider"
            // hint rather than "<x> not found in PATH" (which is CLI-only).
            command: String::new(),
        };
    }
    let resolved = resolve_provider(&ai);
    let path = which_command(&resolved.command);
    AiStatus {
        available: path.is_some(),
        path,
        provider: ai.provider,
        command: resolved.command,
    }
}

/// One limit window as the Claude CLI reports it: a label, how much of it is
/// used, and when it rolls over.
#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PlanWindow {
    /// The CLI's own wording ("Current session", "Current week (all models)").
    /// Passed through rather than mapped to our own keys: Anthropic adds
    /// windows (per-model weeklies) and we'd silently drop the ones we
    /// didn't know about.
    label: String,
    percent_used: u8,
    /// Reset moment, verbatim ("Oct 5, 3:59pm (Europe/Paris)").
    resets: String,
}

/// Subscription limit windows, read from `claude -p "/usage"`.
///
/// There is no structured surface for these: the CLI renders them as prose,
/// and the `rate_limit_event` on the streaming path carries only a status and
/// a reset time — no percentage. So we parse the prose, and skip any line
/// that doesn't match rather than guessing.
///
/// Free to call — the slash command is handled locally, no model request.
/// Returns an empty list when the provider isn't the Claude CLI, when it
/// isn't installed, or when the fetch fails (notably with
/// `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`, which blocks the lookup the
/// CLI needs to fill these in).
#[tauri::command]
pub async fn ai_plan_usage(
    config: State<'_, Arc<Mutex<Config>>>,
) -> Result<Vec<PlanWindow>, String> {
    let provider = config.lock().ai.provider.clone();
    if is_api_provider(&provider) || provider == "codex" || provider == "custom" {
        return Ok(vec![]);
    }
    let Some(bin) = which_command("claude") else {
        return Ok(vec![]);
    };
    let text = tauri::async_runtime::spawn_blocking(move || {
        let mut c = Command::new(bin);
        c.args(["-p", "/usage", "--output-format", "json"]);
        crate::env_fix::sanitize(&mut c);
        crate::env_fix::no_window(&mut c);
        c.env("PATH", crate::env_fix::user_path());
        crate::env_fix::capture_with_timeout(c, 30)
    })
    .await
    .map_err(|e| e.to_string())?;

    let Some(text) = text else {
        return Ok(vec![]);
    };
    let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) else {
        return Ok(vec![]);
    };
    Ok(parse_plan_windows(v["result"].as_str().unwrap_or("")))
}

/// Pull the limit lines out of `/usage`'s prose. Shape, verbatim:
/// `Current session: 6% used · resets Sep 30, 2:49pm (Europe/Paris)`
fn parse_plan_windows(text: &str) -> Vec<PlanWindow> {
    let mut out = Vec::new();
    for line in text.lines() {
        let line = line.trim();
        let Some((label, rest)) = line.split_once(": ") else {
            continue;
        };
        let Some((pct, after)) = rest.split_once("% used") else {
            continue;
        };
        let Ok(percent_used) = pct.trim().parse::<u8>() else {
            continue;
        };
        // "· resets <when>" — the separator is a middle dot, but don't depend
        // on it: find the keyword instead.
        let resets = after
            .split_once("resets ")
            .map(|(_, when)| when.trim().to_string())
            .unwrap_or_default();
        out.push(PlanWindow {
            label: label.trim().to_string(),
            percent_used,
            resets,
        });
    }
    out
}

/// Probe whether a given CLI command is resolvable in PATH. Lets the Settings
/// UI show a live "detected / not found" badge for the selected provider
/// without waiting for the config to be saved.
#[tauri::command]
pub fn ai_probe(command: String) -> bool {
    which_command(&command).is_some()
}

/// The model the provider would use by default (so the Settings UI can show it
/// as a placeholder). Empty model in config means "let the provider decide" —
/// this surfaces what that resolves to. Returns None if it can't be determined.
#[tauri::command]
pub fn ai_default_model(provider: String) -> Option<String> {
    match provider.as_str() {
        "claude" => {
            // The Claude CLI honours $ANTHROPIC_MODEL, then its settings file.
            if let Ok(m) = std::env::var("ANTHROPIC_MODEL") {
                let m = m.trim().to_string();
                if !m.is_empty() {
                    return Some(m);
                }
            }
            json_string_field(".claude/settings.json", "model")
        }
        "codex" => toml_string_field(".codex/config.toml", "model"),
        "openai" => Some("gpt-4o-mini".to_string()),
        "deepseek" => Some("deepseek-chat".to_string()),
        _ => None,
    }
}

fn home_join(rel: &str) -> Option<std::path::PathBuf> {
    crate::paths::home_dir().map(|h| h.join(rel))
}

fn json_string_field(rel: &str, field: &str) -> Option<String> {
    let s = std::fs::read_to_string(home_join(rel)?).ok()?;
    let v: serde_json::Value = serde_json::from_str(&s).ok()?;
    v.get(field)?
        .as_str()
        .map(str::to_string)
        .filter(|x| !x.trim().is_empty())
}

fn toml_string_field(rel: &str, field: &str) -> Option<String> {
    let s = std::fs::read_to_string(home_join(rel)?).ok()?;
    let v: toml::Value = toml::from_str(&s).ok()?;
    v.get(field)?
        .as_str()
        .map(str::to_string)
        .filter(|x| !x.trim().is_empty())
}

/// Whether the provider id is an HTTP API provider (vs a local CLI).
fn is_api_provider(p: &str) -> bool {
    matches!(p, "openai" | "deepseek" | "api")
}

/// An OpenAI-compatible HTTP endpoint resolved from config.
struct ApiProvider {
    base_url: String,
    api_key: String,
    model: String,
}

fn resolve_api(cfg: &AiConfig) -> ApiProvider {
    match cfg.provider.as_str() {
        "openai" => ApiProvider {
            base_url: "https://api.openai.com/v1".to_string(),
            api_key: cfg.openai_api_key.trim().to_string(),
            model: pick(&cfg.openai_model, "gpt-4o-mini"),
        },
        "deepseek" => ApiProvider {
            base_url: "https://api.deepseek.com/v1".to_string(),
            api_key: cfg.deepseek_api_key.trim().to_string(),
            model: pick(&cfg.deepseek_model, "deepseek-chat"),
        },
        // "api" — generic OpenAI-compatible endpoint.
        _ => ApiProvider {
            base_url: cfg.api_base_url.trim().trim_end_matches('/').to_string(),
            api_key: cfg.api_api_key.trim().to_string(),
            model: cfg.api_model.trim().to_string(),
        },
    }
}

fn pick(model: &str, default: &str) -> String {
    if model.trim().is_empty() {
        default.to_string()
    } else {
        model.trim().to_string()
    }
}

/// What CLI to run for the active provider, resolved from config.
struct ResolvedProvider {
    command: String,
    /// Args with a literal `{prompt}` token (replaced at spawn time).
    args: Vec<String>,
    /// Env var to receive the API key, if the provider uses one.
    key_env: Option<String>,
    api_key: String,
    /// stdout is newline-delimited JSON events rather than plain text. Only
    /// the Claude CLI speaks it, and only that mode reports consumption.
    stream_json: bool,
}

fn resolve_provider(cfg: &AiConfig) -> ResolvedProvider {
    match cfg.provider.as_str() {
        "codex" => {
            // `codex exec` prints only the final message to stdout (progress goes
            // to stderr); --skip-git-repo-check so it works outside a git repo.
            let mut args = vec!["exec".to_string()];
            if !cfg.codex_model.trim().is_empty() {
                args.push("--model".to_string());
                args.push(cfg.codex_model.trim().to_string());
            }
            args.push("--skip-git-repo-check".to_string());
            args.push("{prompt}".to_string());
            ResolvedProvider {
                command: "codex".to_string(),
                args,
                key_env: Some("OPENAI_API_KEY".to_string()),
                api_key: cfg.codex_api_key.clone(),
                stream_json: false,
            }
        }
        "custom" => ResolvedProvider {
            command: cfg.custom_command.clone(),
            args: if cfg.custom_args.is_empty() {
                vec!["{prompt}".to_string()]
            } else {
                cfg.custom_args.clone()
            },
            key_env: if cfg.custom_key_env.trim().is_empty() {
                None
            } else {
                Some(cfg.custom_key_env.clone())
            },
            api_key: cfg.custom_api_key.clone(),
            stream_json: false,
        },
        // "claude" and anything unrecognized fall back to the Claude CLI.
        _ => {
            let mut args = Vec::new();
            if !cfg.claude_model.trim().is_empty() {
                args.push("--model".to_string());
                args.push(cfg.claude_model.trim().to_string());
            }
            // stream-json (with partial messages) keeps the token-by-token
            // streaming of plain text mode AND carries what the plain mode
            // throws away: the cost of the call and the subscription window.
            args.push("--output-format".to_string());
            args.push("stream-json".to_string());
            args.push("--verbose".to_string());
            args.push("--include-partial-messages".to_string());
            args.push("-p".to_string());
            args.push("{prompt}".to_string());
            ResolvedProvider {
                command: "claude".to_string(),
                args,
                key_env: None,
                api_key: String::new(),
                stream_json: true,
            }
        }
    }
}

/// Resolve a command to an absolute executable path, searching the user's
/// *real* PATH (the login+interactive shell's, recovered in `env_fix`) — a
/// GUI-launched app's inherited PATH usually lacks npm/nvm/`~/.local/bin`.
fn which_command(cmd: &str) -> Option<String> {
    let cmd = cmd.trim();
    if cmd.is_empty() {
        return None;
    }
    if cmd.chars().any(std::path::is_separator) {
        let p = std::path::Path::new(cmd);
        return is_executable(p).then(|| p.display().to_string());
    }
    // `split_paths` honours the platform separator (`:` on Unix, `;` on Windows).
    for dir in std::env::split_paths(&crate::env_fix::user_path()) {
        if dir.as_os_str().is_empty() {
            continue;
        }
        let p = dir.join(cmd);
        if is_executable(&p) {
            return Some(p.display().to_string());
        }
        // On Windows the command name often lacks its extension.
        #[cfg(windows)]
        for ext in ["exe", "cmd", "bat", "com"] {
            let pe = dir.join(format!("{cmd}.{ext}"));
            if is_executable(&pe) {
                return Some(pe.display().to_string());
            }
        }
    }
    None
}

#[cfg(unix)]
fn is_executable(p: &std::path::Path) -> bool {
    use std::os::unix::fs::PermissionsExt;
    std::fs::metadata(p)
        .map(|m| m.is_file() && m.permissions().mode() & 0o111 != 0)
        .unwrap_or(false)
}

#[cfg(windows)]
fn is_executable(p: &std::path::Path) -> bool {
    // No POSIX execute bit on Windows; treat any regular file as runnable.
    p.is_file()
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct AiChunkEvent {
    request_id: u64,
    delta: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct AiDoneEvent {
    request_id: u64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct AiErrorEvent {
    request_id: u64,
    message: String,
}

/// UI language code → the English name of that language, as used in the prompts
/// to tell the model which language to answer in. Mirrors `LANGUAGES` in
/// `src/i18n.ts`; anything unknown falls back to English, like the UI does.
fn language_name(code: &str) -> &'static str {
    let base = code
        .split(['-', '_'])
        .next()
        .unwrap_or("")
        .to_ascii_lowercase();
    match base.as_str() {
        "fr" => "French",
        "es" => "Spanish",
        "de" => "German",
        "it" => "Italian",
        "pt" => "Portuguese",
        "nl" => "Dutch",
        "tr" => "Turkish",
        "ru" => "Russian",
        "ar" => "Arabic",
        "hi" => "Hindi",
        "zh" => "Chinese",
        "ja" => "Japanese",
        "ko" => "Korean",
        _ => "English",
    }
}

/// What a provider reports about consumption. Every field is optional: each
/// provider exposes a different slice, and the frontend merges partial updates
/// rather than waiting for one complete picture.
#[derive(Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct AiUsageEvent {
    request_id: u64,
    /// Cost of THIS request, in USD — CLI providers that price the call.
    cost_usd: Option<f64>,
    input_tokens: Option<u64>,
    output_tokens: Option<u64>,
    cache_read_tokens: Option<u64>,
    model: Option<String>,
    /// Subscription window: which one ("five_hour"), whether it still allows
    /// requests, and the unix second it resets at.
    plan_window: Option<String>,
    plan_status: Option<String>,
    plan_resets_at: Option<i64>,
    /// Per-minute quota left, read from an HTTP provider's rate-limit headers.
    remaining_requests: Option<String>,
    remaining_tokens: Option<String>,
}

fn build_prompt(command: &str, output: &str, exit_code: i32, language: &str) -> String {
    let mut p = String::new();
    p.push_str("Analyze this terminal block.\n\n");
    p.push_str("Command:\n```\n");
    p.push_str(command.trim());
    p.push_str("\n```\n\n");
    if !output.trim().is_empty() {
        let truncated: String = output.chars().take(MAX_OUTPUT_CHARS).collect();
        let was_truncated = output.chars().count() > MAX_OUTPUT_CHARS;
        p.push_str("Output:\n```\n");
        p.push_str(&truncated);
        if was_truncated {
            p.push_str("\n[…output truncated]");
        }
        p.push_str("\n```\n\n");
    }
    p.push_str(&format!("Exit code: {}\n\n", exit_code));
    if exit_code != 0 {
        p.push_str(
            "The command failed. Explain the error in 2-3 sentences and suggest a concrete fix.",
        );
    } else {
        p.push_str("Explain in 2-3 sentences what the command does and the gist of its output.");
    }
    p.push_str(&format!(
        " Answer in {}, with no preamble — get straight to the point.",
        language_name(language)
    ));
    p
}

fn build_generate_prompt(query: &str, cwd: Option<&str>, listing: Option<&str>) -> String {
    let mut p = String::new();
    p.push_str("Generate a SINGLE shell command for this request.\n\n");
    p.push_str("Request: ");
    p.push_str(query.trim());
    p.push_str("\n\n");
    if cwd.is_some() || listing.is_some() {
        p.push_str("Context:\n");
        if let Some(cwd) = cwd {
            p.push_str(&format!("- Current directory: {}\n", cwd));
        }
        if let Some(listing) = listing {
            p.push_str("- Directory contents:\n");
            for line in listing.lines() {
                p.push_str("  ");
                p.push_str(line);
                p.push('\n');
            }
        }
        p.push('\n');
    }
    // No language instruction here on purpose: the answer is a command line,
    // not prose.
    p.push_str("Strict rules:\n");
    p.push_str("- Answer with ONLY the command, nothing else.\n");
    p.push_str("- No explanation, no introductory sentence.\n");
    p.push_str("- No backticks, no markdown.\n");
    p.push_str("- No ```bash``` block or equivalent.\n");
    p.push_str("- Target: zsh/bash on Linux.\n");
    p.push_str(
        "- If the request is ambiguous, pick the most likely reading and still give a command.\n",
    );
    p.push_str("- Prefer a single line (use && or ; to chain when needed).\n");
    p.push_str(
        "- When referring to a path present in the context, use the EXACT name given above.\n",
    );
    p
}

/// Best-effort listing of a directory's top-level entries (dirs + files,
/// hidden entries skipped, limited to ~30). Used to give the model context
/// for "génère une commande qui touche ces fichiers".
fn sample_directory(path: &str) -> Option<String> {
    let entries = std::fs::read_dir(path).ok()?;
    let mut dirs: Vec<String> = Vec::new();
    let mut files: Vec<String> = Vec::new();
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') {
            continue;
        }
        let is_dir = entry
            .file_type()
            .ok()
            .map(|t| t.is_dir())
            .unwrap_or(false);
        if is_dir {
            dirs.push(format!("{}/", name));
        } else {
            files.push(name);
        }
        if dirs.len() + files.len() >= 60 {
            break;
        }
    }
    dirs.sort();
    files.sort();
    dirs.truncate(20);
    files.truncate(20);
    if dirs.is_empty() && files.is_empty() {
        return None;
    }
    let mut s = String::new();
    if !dirs.is_empty() {
        s.push_str("dossiers : ");
        s.push_str(&dirs.join(" "));
        s.push('\n');
    }
    if !files.is_empty() {
        s.push_str("fichiers : ");
        s.push_str(&files.join(" "));
    }
    Some(s)
}

#[tauri::command]
pub fn ai_explain_block(
    app: AppHandle,
    state: State<'_, Arc<AiManager>>,
    config: State<'_, Arc<Mutex<Config>>>,
    command: String,
    output: Option<String>,
    exit_code: i32,
) -> Result<u64, String> {
    let (ai, language) = {
        let cfg = config.lock();
        (cfg.ai.clone(), cfg.language.clone())
    };
    let prompt = build_prompt(
        &command,
        output.as_deref().unwrap_or(""),
        exit_code,
        &language,
    );
    dispatch(app, state, ai, prompt)
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

fn build_chat_prompt(messages: &[ChatMessage], language: &str) -> String {
    let mut p = String::new();
    p.push_str("You are an AI assistant embedded in the Lume terminal. You answer the user's last question using the conversation below.\n\n");
    p.push_str("---\n");
    for msg in messages.iter() {
        let label = match msg.role.as_str() {
            "user" => "USER",
            "assistant" => "ASSISTANT",
            other => other,
        };
        p.push_str(&format!("\n[{}]\n", label));
        p.push_str(msg.content.trim());
        p.push('\n');
    }
    p.push_str("\n---\n\n");
    p.push_str(&format!(
        "Answer the last USER question above concisely, in {}. Keep the context of the whole conversation. No preamble (\"Sure, …\") — get straight to the point.",
        language_name(language)
    ));
    p
}

#[tauri::command]
pub fn ai_chat(
    app: AppHandle,
    state: State<'_, Arc<AiManager>>,
    config: State<'_, Arc<Mutex<Config>>>,
    messages: Vec<ChatMessage>,
) -> Result<u64, String> {
    if messages.is_empty() {
        return Err("ai_chat: empty messages".to_string());
    }
    let (ai, language) = {
        let cfg = config.lock();
        (cfg.ai.clone(), cfg.language.clone())
    };
    let prompt = build_chat_prompt(&messages, &language);
    dispatch(app, state, ai, prompt)
}

#[tauri::command]
pub fn ai_generate_command(
    app: AppHandle,
    state: State<'_, Arc<AiManager>>,
    pty_state: State<'_, Arc<PtyManager>>,
    config: State<'_, Arc<Mutex<Config>>>,
    query: String,
    pty_id: Option<u64>,
) -> Result<u64, String> {
    let cwd = pty_id.and_then(|id| pty_cwd(pty_state.inner(), id));
    let listing = cwd.as_deref().and_then(sample_directory);
    let prompt = build_generate_prompt(&query, cwd.as_deref(), listing.as_deref());
    let ai = config.lock().ai.clone();
    dispatch(app, state, ai, prompt)
}

/// Route a built prompt to the active provider's transport (CLI or HTTP API).
fn dispatch(
    app: AppHandle,
    state: State<'_, Arc<AiManager>>,
    ai: AiConfig,
    prompt: String,
) -> Result<u64, String> {
    if is_api_provider(&ai.provider) {
        api_request(app, state, resolve_api(&ai), prompt)
    } else {
        spawn_request(app, state, resolve_provider(&ai), prompt)
    }
}

/// Errors that reach the UI travel as i18n keys, never as sentences: only the
/// frontend knows the UI language at render time, and hardcoding one language
/// here is what made the assistant answer in French for everyone (issue #26).
/// `lume.err:<key>[|<arg>]`; anything else — a provider's own stderr, say —
/// is passed through untouched. Keys live under `aiErr.*` in `src/i18n.ts`.
fn err(key: &str) -> String {
    format!("lume.err:{key}")
}

fn err_arg(key: &str, arg: &str) -> String {
    format!("lume.err:{key}|{arg}")
}

fn spawn_request(
    app: AppHandle,
    state: State<'_, Arc<AiManager>>,
    provider: ResolvedProvider,
    prompt: String,
) -> Result<u64, String> {
    if provider.command.trim().is_empty() {
        return Err(err("noProvider"));
    }
    let bin_path =
        which_command(&provider.command).ok_or_else(|| err_arg("notInPath", &provider.command))?;

    // Substitute the {prompt} token; if no arg carries it, append the prompt.
    let mut final_args: Vec<String> = Vec::new();
    let mut replaced = false;
    for a in &provider.args {
        if a.contains("{prompt}") {
            final_args.push(a.replace("{prompt}", &prompt));
            replaced = true;
        } else {
            final_args.push(a.clone());
        }
    }
    if !replaced {
        final_args.push(prompt.clone());
    }

    let request_id = state.next_id.fetch_add(1, Ordering::Relaxed);

    let mut cmd = Command::new(&bin_path);
    cmd.args(&final_args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    // Clean the AppImage pollution and hand the CLI the user's real PATH so it
    // can find its own runtime (node, etc.), mirroring a terminal launch.
    crate::env_fix::sanitize(&mut cmd);
    // Windows: don't pop up a console window while the CLI runs.
    crate::env_fix::no_window(&mut cmd);
    cmd.env("PATH", crate::env_fix::user_path());
    if let Some(env_var) = &provider.key_env {
        if !provider.api_key.trim().is_empty() {
            cmd.env(env_var, &provider.api_key);
        }
    }

    let stream_json = provider.stream_json;
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("spawn {}: {e}", provider.command))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "stdout pipe missing".to_string())?;
    let stderr = child.stderr.take();

    state.children.lock().insert(request_id, child);

    {
        let app = app.clone();
        let manager = state.inner().clone();
        thread::spawn(move || {
            stream_stdout(app.clone(), request_id, stdout, stream_json);
            // Wait for the child to fully exit, then signal completion or error.
            let mut child_opt = manager.children.lock().remove(&request_id);
            let (success, stderr_text) = match child_opt.as_mut() {
                Some(c) => {
                    let status = c.wait().ok();
                    let stderr_text = stderr
                        .map(|mut s| {
                            let mut buf = Vec::new();
                            let _ = s.read_to_end(&mut buf);
                            String::from_utf8_lossy(&buf).trim().to_string()
                        })
                        .unwrap_or_default();
                    (
                        status.map(|s| s.success()).unwrap_or(false),
                        stderr_text,
                    )
                }
                None => (true, String::new()),
            };
            if success {
                let _ = app.emit("ai:done", AiDoneEvent { request_id });
            } else {
                let msg = if stderr_text.is_empty() {
                    err("providerFailed")
                } else {
                    stderr_text
                };
                let _ = app.emit(
                    "ai:error",
                    AiErrorEvent {
                        request_id,
                        message: msg,
                    },
                );
            }
        });
    }

    Ok(request_id)
}

/// Stream a completion from an OpenAI-compatible HTTP API. Mirrors the CLI path:
/// returns a request id immediately and emits ai:chunk / ai:done / ai:error from
/// a background thread. ureq is blocking, so a plain thread fits (no async).
fn api_request(
    app: AppHandle,
    state: State<'_, Arc<AiManager>>,
    api: ApiProvider,
    prompt: String,
) -> Result<u64, String> {
    if api.base_url.is_empty() {
        return Err(err("missingUrl"));
    }
    if api.api_key.is_empty() {
        return Err(err("missingKey"));
    }
    if api.model.is_empty() {
        return Err(err("missingModel"));
    }

    let request_id = state.next_id.fetch_add(1, Ordering::Relaxed);
    let cancel = Arc::new(AtomicBool::new(false));
    state.api_cancels.lock().insert(request_id, cancel.clone());
    let manager = state.inner().clone();

    thread::spawn(move || {
        let result = stream_api(&app, request_id, &api, &prompt, &cancel);
        manager.api_cancels.lock().remove(&request_id);
        if cancel.load(Ordering::Relaxed) {
            return; // cancelled by the user — stay silent
        }
        match result {
            Ok(()) => {
                let _ = app.emit("ai:done", AiDoneEvent { request_id });
            }
            Err(msg) => {
                let _ = app.emit("ai:error", AiErrorEvent { request_id, message: msg });
            }
        }
    });

    Ok(request_id)
}

fn stream_api(
    app: &AppHandle,
    request_id: u64,
    api: &ApiProvider,
    prompt: &str,
    cancel: &AtomicBool,
) -> Result<(), String> {
    let url = format!("{}/chat/completions", api.base_url);
    let body = serde_json::json!({
        "model": api.model,
        "stream": true,
        "messages": [{ "role": "user", "content": prompt }],
    });

    // Connect + per-read timeouts: without them an unreachable/stalled endpoint
    // parks this thread forever — the cancel flag is only re-checked between
    // reads, so ai_cancel never takes effect and each retry leaks a thread.
    // 120 s per read stays well clear of legitimate slow-model stalls.
    let agent = ureq::AgentBuilder::new()
        .timeout_connect(std::time::Duration::from_secs(10))
        .timeout_read(std::time::Duration::from_secs(120))
        .build();
    let resp = agent
        .post(&url)
        .set("Authorization", &format!("Bearer {}", api.api_key))
        .set("Content-Type", "application/json")
        .send_json(body);

    let resp = match resp {
        Ok(r) => r,
        Err(ureq::Error::Status(code, r)) => {
            let txt = r.into_string().unwrap_or_default();
            let snippet: String = txt.chars().take(300).collect();
            return Err(format!("HTTP {code} — {snippet}"));
        }
        Err(e) => return Err(err_arg("requestFailed", &e.to_string())),
    };

    // Quota left, straight off the response we just made — no extra request.
    // Two naming schemes in the wild: OpenAI-compatible `x-ratelimit-*` and
    // Anthropic's `anthropic-ratelimit-*`. Absent on local endpoints (Ollama),
    // which is correct: nothing is being metered there.
    let remaining_requests = resp
        .header("x-ratelimit-remaining-requests")
        .or_else(|| resp.header("anthropic-ratelimit-requests-remaining"))
        .map(str::to_string);
    let remaining_tokens = resp
        .header("x-ratelimit-remaining-tokens")
        .or_else(|| resp.header("anthropic-ratelimit-tokens-remaining"))
        .map(str::to_string);
    if remaining_requests.is_some() || remaining_tokens.is_some() {
        let _ = app.emit(
            "ai:usage",
            AiUsageEvent {
                request_id,
                model: Some(api.model.clone()),
                remaining_requests,
                remaining_tokens,
                ..Default::default()
            },
        );
    }

    // SSE: lines like `data: {json}`, terminated by `data: [DONE]`.
    let mut reader = std::io::BufReader::new(resp.into_reader());
    let mut line = String::new();
    loop {
        if cancel.load(Ordering::Relaxed) {
            return Ok(());
        }
        line.clear();
        let n = reader.read_line(&mut line).map_err(|e| e.to_string())?;
        if n == 0 {
            break; // EOF
        }
        let Some(data) = line.trim().strip_prefix("data:") else {
            continue;
        };
        let data = data.trim();
        if data == "[DONE]" {
            break;
        }
        if data.is_empty() {
            continue;
        }
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(data) {
            if let Some(delta) = v["choices"][0]["delta"]["content"].as_str() {
                if !delta.is_empty() {
                    let _ = app.emit(
                        "ai:chunk",
                        AiChunkEvent { request_id, delta: delta.to_string() },
                    );
                }
            }
        }
    }
    Ok(())
}

/// Read a CLI's stdout and turn it into ai:chunk events. Two shapes: plain
/// text (byte stream, split anywhere — including mid-codepoint) and the Claude
/// CLI's newline-delimited JSON, which also carries the usage numbers.
fn stream_stdout(
    app: AppHandle,
    request_id: u64,
    stdout: std::process::ChildStdout,
    stream_json: bool,
) {
    if stream_json {
        return stream_stdout_json(app, request_id, stdout);
    }
    stream_stdout_text(app, request_id, stdout)
}

/// Newline-delimited JSON events (`--output-format stream-json`). Text arrives
/// as `stream_event` deltas; consumption as `rate_limit_event` (the plan
/// window) and a final `result` (cost and tokens). Unknown event types are
/// skipped, so a CLI update that adds one can't break the stream.
fn stream_stdout_json(app: AppHandle, request_id: u64, stdout: std::process::ChildStdout) {
    let reader = std::io::BufReader::new(stdout);
    for line in reader.lines() {
        let Ok(line) = line else { break };
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let Ok(v) = serde_json::from_str::<serde_json::Value>(line) else {
            continue;
        };
        match parse_cli_event(&v) {
            Some(CliEvent::Text(t)) => {
                let _ = app.emit("ai:chunk", AiChunkEvent { request_id, delta: t });
            }
            Some(CliEvent::Usage(mut u)) => {
                u.request_id = request_id;
                let _ = app.emit("ai:usage", u);
            }
            None => {}
        }
    }
}

enum CliEvent {
    Text(String),
    Usage(AiUsageEvent),
}

/// Map one `stream-json` line to what the UI needs. Kept pure so the shapes
/// can be pinned by tests — a CLI update that renames a field would otherwise
/// degrade silently into "no text, no numbers" with nothing to catch it.
fn parse_cli_event(v: &serde_json::Value) -> Option<CliEvent> {
    match v["type"].as_str()? {
        "stream_event" => {
            let ev = &v["event"];
            if ev["type"] != "content_block_delta" || ev["delta"]["type"] != "text_delta" {
                return None;
            }
            let t = ev["delta"]["text"].as_str()?;
            (!t.is_empty()).then(|| CliEvent::Text(t.to_string()))
        }
        "rate_limit_event" => {
            let info = &v["rate_limit_info"];
            Some(CliEvent::Usage(AiUsageEvent {
                plan_window: info["rateLimitType"].as_str().map(str::to_string),
                plan_status: info["status"].as_str().map(str::to_string),
                plan_resets_at: info["resetsAt"].as_i64(),
                ..Default::default()
            }))
        }
        "result" => {
            let usage = &v["usage"];
            Some(CliEvent::Usage(AiUsageEvent {
                cost_usd: v["total_cost_usd"].as_f64(),
                input_tokens: usage["input_tokens"].as_u64(),
                output_tokens: usage["output_tokens"].as_u64(),
                cache_read_tokens: usage["cache_read_input_tokens"].as_u64(),
                // modelUsage is keyed by model name — the first key is the
                // model that actually served the request.
                model: v["modelUsage"]
                    .as_object()
                    .and_then(|m| m.keys().next().cloned()),
                ..Default::default()
            }))
        }
        _ => None,
    }
}

fn stream_stdout_text(app: AppHandle, request_id: u64, mut stdout: std::process::ChildStdout) {
    let mut leftover: Vec<u8> = Vec::new();
    let mut buf = [0u8; 4096];
    loop {
        match stdout.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => {
                leftover.extend_from_slice(&buf[..n]);
                match std::str::from_utf8(&leftover) {
                    Ok(s) => {
                        let _ = app.emit(
                            "ai:chunk",
                            AiChunkEvent {
                                request_id,
                                delta: s.to_string(),
                            },
                        );
                        leftover.clear();
                    }
                    Err(e) => {
                        let valid_up_to = e.valid_up_to();
                        if valid_up_to > 0 {
                            // SAFETY: valid_up_to is guaranteed valid UTF-8 by from_utf8 contract.
                            let s = unsafe {
                                std::str::from_utf8_unchecked(&leftover[..valid_up_to])
                            }
                            .to_string();
                            let _ = app.emit(
                                "ai:chunk",
                                AiChunkEvent {
                                    request_id,
                                    delta: s,
                                },
                            );
                        }
                        leftover.drain(..valid_up_to);
                    }
                }
            }
            Err(_) => break,
        }
    }
    if !leftover.is_empty() {
        let s = String::from_utf8_lossy(&leftover).to_string();
        let _ = app.emit(
            "ai:chunk",
            AiChunkEvent {
                request_id,
                delta: s,
            },
        );
    }
}

#[tauri::command]
pub fn ai_cancel(state: State<'_, Arc<AiManager>>, request_id: u64) -> Result<(), String> {
    if let Some(mut child) = state.children.lock().remove(&request_id) {
        let _ = child.kill();
    }
    if let Some(flag) = state.api_cancels.lock().get(&request_id) {
        flag.store(true, Ordering::Relaxed);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_prompt_includes_command_and_output() {
        let p = build_prompt("ls -la", "total 12\ndrwx user", 0, "en");
        assert!(p.contains("ls -la"));
        assert!(p.contains("total 12"));
        assert!(p.contains("Exit code: 0"));
        assert!(p.contains("Explain"));
    }

    #[test]
    fn build_prompt_failure_path() {
        let p = build_prompt("cd nonexistent", "no such file", 1, "en");
        assert!(p.contains("Exit code: 1"));
        assert!(p.contains("failed"));
    }

    #[test]
    fn build_prompt_truncates_long_output() {
        let big: String = "x".repeat(MAX_OUTPUT_CHARS + 5000);
        let p = build_prompt("dump", &big, 0, "en");
        assert!(p.contains("[…output truncated]"));
    }

    /// The UI language — not the codebase's language — drives the answer.
    #[test]
    fn prompts_follow_the_ui_language() {
        assert!(build_prompt("ls", "", 0, "en").contains("Answer in English"));
        assert!(build_prompt("ls", "", 0, "fr").contains("Answer in French"));
        assert!(build_prompt("ls", "", 1, "ja").contains("Answer in Japanese"));
        // Regional tags and unknown codes still resolve.
        assert!(build_prompt("ls", "", 0, "pt-BR").contains("Answer in Portuguese"));
        assert!(build_prompt("ls", "", 0, "xx").contains("Answer in English"));
        let chat = build_chat_prompt(
            &[ChatMessage {
                role: "user".into(),
                content: "what is ls?".into(),
            }],
            "de",
        );
        assert!(chat.contains("in German"));
    }

    /// Captured verbatim from `claude -p "/usage"`. The percentages only
    /// appear when non-essential traffic is allowed — the same output without
    /// them must yield an empty list, not garbage.
    #[test]
    fn parses_plan_usage_windows() {
        let text = "You are currently using your subscription to power your Claude Code usage\n\
            \n\
            Current session: 6% used · resets Sep 30, 2:49pm (Europe/Paris)\n\
            Current week (all models): 3% used · resets Oct 5, 3:59pm (Europe/Paris)\n\
            Current week (Fable): 0% used · resets Oct 5, 4pm (Europe/Paris)\n\
            \n\
            What's contributing to your limits usage?\n\
            Last 24h · 142 requests · 9 sessions\n\
              92% of your usage was at >150k context\n\
              Top skills: /claude-api 5%\n";
        let w = parse_plan_windows(text);
        assert_eq!(w.len(), 3, "only the three limit lines, not the prose");
        assert_eq!(w[0].label, "Current session");
        assert_eq!(w[0].percent_used, 6);
        assert_eq!(w[0].resets, "Sep 30, 2:49pm (Europe/Paris)");
        assert_eq!(w[1].label, "Current week (all models)");
        assert_eq!(w[2].percent_used, 0);

        // The blocked variant: same command, no limit lines at all.
        let blocked = "You are currently using your subscription to power your Claude Code usage\n\
            \n\
            What's contributing to your limits usage?\n\
            Last 24h · 96 requests · 8 sessions\n\
              87% of your usage was at >150k context\n";
        assert!(parse_plan_windows(blocked).is_empty());
    }

    /// Lines captured verbatim from `claude -p … --output-format stream-json
    /// --verbose --include-partial-messages`. If the CLI renames a field these
    /// break here rather than silently emptying the pill.
    #[test]
    fn parses_claude_stream_json_events() {
        let line = |s: &str| serde_json::from_str::<serde_json::Value>(s).unwrap();

        let text = line(
            r#"{"type":"stream_event","event":{"type":"content_block_delta","index":0,
               "delta":{"type":"text_delta","text":"1"}},"session_id":"x"}"#,
        );
        match parse_cli_event(&text) {
            Some(CliEvent::Text(t)) => assert_eq!(t, "1"),
            _ => panic!("expected a text delta"),
        }

        let plan = line(
            r#"{"type":"rate_limit_event","rate_limit_info":{"status":"allowed",
               "resetsAt":1790772600,"rateLimitType":"five_hour",
               "isUsingOverage":false}}"#,
        );
        match parse_cli_event(&plan) {
            Some(CliEvent::Usage(u)) => {
                assert_eq!(u.plan_status.as_deref(), Some("allowed"));
                assert_eq!(u.plan_window.as_deref(), Some("five_hour"));
                assert_eq!(u.plan_resets_at, Some(1790772600));
                assert_eq!(u.cost_usd, None);
            }
            _ => panic!("expected plan usage"),
        }

        let result = line(
            r#"{"type":"result","total_cost_usd":0.0988765,
               "usage":{"input_tokens":2,"output_tokens":14,
                        "cache_read_input_tokens":13793,
                        "cache_creation_input_tokens":9162},
               "modelUsage":{"claude-opus-5[1m]":{"costUSD":0.0988765}}}"#,
        );
        match parse_cli_event(&result) {
            Some(CliEvent::Usage(u)) => {
                assert_eq!(u.cost_usd, Some(0.0988765));
                assert_eq!(u.input_tokens, Some(2));
                assert_eq!(u.output_tokens, Some(14));
                assert_eq!(u.cache_read_tokens, Some(13793));
                assert_eq!(u.model.as_deref(), Some("claude-opus-5[1m]"));
            }
            _ => panic!("expected result usage"),
        }

        // Event kinds we don't consume must be skipped, not mishandled: the
        // CLI emits several per call and adds more over time.
        assert!(parse_cli_event(&line(r#"{"type":"system","subtype":"init"}"#)).is_none());
        assert!(parse_cli_event(&line(r#"{"type":"assistant","message":{}}"#)).is_none());
        assert!(parse_cli_event(&line(
            r#"{"type":"stream_event","event":{"type":"message_stop"}}"#
        ))
        .is_none());
    }

    /// The frontend parses these; `aiErrorText` in `src/ai.ts` must keep up.
    #[test]
    fn errors_are_i18n_keys_not_sentences() {
        assert_eq!(err("noProvider"), "lume.err:noProvider");
        assert_eq!(err_arg("notInPath", "my-llm"), "lume.err:notInPath|my-llm");
    }

    #[test]
    fn generate_prompt_includes_cwd_and_listing() {
        let p = build_generate_prompt(
            "count the Rust lines",
            Some("/home/user/project"),
            Some("dirs: src-tauri/ src/\nfiles: package.json"),
        );
        assert!(p.contains("Current directory: /home/user/project"));
        assert!(p.contains("src-tauri/"));
        assert!(p.contains("When referring to a path"));
    }

    #[test]
    fn generate_prompt_omits_context_when_missing() {
        let p = build_generate_prompt("ls", None, None);
        assert!(!p.contains("Context:"));
        assert!(!p.contains("Current directory"));
    }

    #[test]
    fn chat_prompt_formats_conversation() {
        let p = build_chat_prompt(
            &[
                ChatMessage {
                    role: "user".into(),
                    content: "what is ls?".into(),
                },
                ChatMessage {
                    role: "assistant".into(),
                    content: "ls lists files.".into(),
                },
                ChatMessage {
                    role: "user".into(),
                    content: "and -la?".into(),
                },
            ],
            "en",
        );
        assert!(p.contains("[USER]"));
        assert!(p.contains("[ASSISTANT]"));
        assert!(p.contains("what is ls"));
        assert!(p.contains("and -la"));
    }
}
