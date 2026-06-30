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
        },
        // "claude" and anything unrecognized fall back to the Claude CLI.
        _ => {
            let mut args = Vec::new();
            if !cfg.claude_model.trim().is_empty() {
                args.push("--model".to_string());
                args.push(cfg.claude_model.trim().to_string());
            }
            args.push("-p".to_string());
            args.push("{prompt}".to_string());
            ResolvedProvider {
                command: "claude".to_string(),
                args,
                key_env: None,
                api_key: String::new(),
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

fn build_prompt(command: &str, output: &str, exit_code: i32) -> String {
    let mut p = String::new();
    p.push_str("Analyse ce bloc de terminal.\n\n");
    p.push_str("Commande :\n```\n");
    p.push_str(command.trim());
    p.push_str("\n```\n\n");
    if !output.trim().is_empty() {
        let truncated: String = output.chars().take(MAX_OUTPUT_CHARS).collect();
        let was_truncated = output.chars().count() > MAX_OUTPUT_CHARS;
        p.push_str("Sortie :\n```\n");
        p.push_str(&truncated);
        if was_truncated {
            p.push_str("\n[…sortie tronquée]");
        }
        p.push_str("\n```\n\n");
    }
    p.push_str(&format!("Code retour : {}\n\n", exit_code));
    if exit_code != 0 {
        p.push_str(
            "La commande a échoué. Explique l'erreur en 2-3 phrases et suggère une correction concrète. Réponds en français, sans introduction, va droit au but.",
        );
    } else {
        p.push_str(
            "Explique en 2-3 phrases ce que la commande fait et l'essentiel de sa sortie. Réponds en français, sans introduction, va droit au but.",
        );
    }
    p
}

fn build_generate_prompt(query: &str, cwd: Option<&str>, listing: Option<&str>) -> String {
    let mut p = String::new();
    p.push_str("Génère UNE SEULE commande shell pour cette demande.\n\n");
    p.push_str("Demande : ");
    p.push_str(query.trim());
    p.push_str("\n\n");
    if cwd.is_some() || listing.is_some() {
        p.push_str("Contexte :\n");
        if let Some(cwd) = cwd {
            p.push_str(&format!("- Répertoire courant : {}\n", cwd));
        }
        if let Some(listing) = listing {
            p.push_str("- Contenu du répertoire :\n");
            for line in listing.lines() {
                p.push_str("  ");
                p.push_str(line);
                p.push('\n');
            }
        }
        p.push('\n');
    }
    p.push_str("Règles strictes :\n");
    p.push_str("- Réponds avec UNIQUEMENT la commande, rien d'autre.\n");
    p.push_str("- Pas d'explication, pas de phrase d'introduction.\n");
    p.push_str("- Pas de backticks, pas de markdown.\n");
    p.push_str("- Pas de bloc ```bash``` ni équivalent.\n");
    p.push_str("- Cible : zsh/bash sur Linux.\n");
    p.push_str("- Si la demande est ambiguë, choisis l'interprétation la plus probable et donne quand même une commande.\n");
    p.push_str("- Une seule ligne de préférence (utilise && ou ; pour chaîner si nécessaire).\n");
    p.push_str("- Quand tu fais référence à un chemin présent dans le contexte, utilise le nom EXACT donné ci-dessus.\n");
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
    let prompt = build_prompt(&command, output.as_deref().unwrap_or(""), exit_code);
    let ai = config.lock().ai.clone();
    dispatch(app, state, ai, prompt)
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

fn build_chat_prompt(messages: &[ChatMessage]) -> String {
    let mut p = String::new();
    p.push_str("Tu es un assistant IA intégré dans le terminal Lume. Tu réponds à la dernière question de l'utilisateur en t'appuyant sur la conversation ci-dessous.\n\n");
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
    p.push_str("Réponds à la dernière question USER ci-dessus, en français, de manière concise. Garde le contexte de toute la conversation. Pas d'introduction (\"Bien sûr, …\"), va droit au but.");
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
    let prompt = build_chat_prompt(&messages);
    let ai = config.lock().ai.clone();
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

fn spawn_request(
    app: AppHandle,
    state: State<'_, Arc<AiManager>>,
    provider: ResolvedProvider,
    prompt: String,
) -> Result<u64, String> {
    if provider.command.trim().is_empty() {
        return Err("Aucun provider IA configuré (Réglages › IA).".to_string());
    }
    let bin_path = which_command(&provider.command).ok_or_else(|| {
        format!(
            "« {} » introuvable dans le PATH (Réglages › IA).",
            provider.command
        )
    })?;

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
    cmd.env("PATH", crate::env_fix::user_path());
    if let Some(env_var) = &provider.key_env {
        if !provider.api_key.trim().is_empty() {
            cmd.env(env_var, &provider.api_key);
        }
    }

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
            stream_stdout(app.clone(), request_id, stdout);
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
                    "Le provider IA a échoué (vérifie qu'il est connecté).".to_string()
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
        return Err("URL de l'API manquante (Réglages › IA).".to_string());
    }
    if api.api_key.is_empty() {
        return Err("Clé API manquante (Réglages › IA).".to_string());
    }
    if api.model.is_empty() {
        return Err("Modèle manquant (Réglages › IA).".to_string());
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

    let resp = ureq::post(&url)
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
        Err(e) => return Err(format!("Requête API échouée : {e}")),
    };

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

fn stream_stdout(app: AppHandle, request_id: u64, mut stdout: std::process::ChildStdout) {
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
        let p = build_prompt("ls -la", "total 12\ndrwx user", 0);
        assert!(p.contains("ls -la"));
        assert!(p.contains("total 12"));
        assert!(p.contains("Code retour : 0"));
        assert!(p.contains("Explique"));
    }

    #[test]
    fn build_prompt_failure_path() {
        let p = build_prompt("cd nonexistent", "no such file", 1);
        assert!(p.contains("Code retour : 1"));
        assert!(p.contains("échoué"));
    }

    #[test]
    fn build_prompt_truncates_long_output() {
        let big: String = "x".repeat(MAX_OUTPUT_CHARS + 5000);
        let p = build_prompt("dump", &big, 0);
        assert!(p.contains("[…sortie tronquée]"));
    }

    #[test]
    fn generate_prompt_includes_cwd_and_listing() {
        let p = build_generate_prompt(
            "compte les lignes Rust",
            Some("/home/user/project"),
            Some("dossiers : src-tauri/ src/\nfichiers : package.json"),
        );
        assert!(p.contains("Répertoire courant : /home/user/project"));
        assert!(p.contains("src-tauri/"));
        assert!(p.contains("Quand tu fais référence à un chemin"));
    }

    #[test]
    fn generate_prompt_omits_context_when_missing() {
        let p = build_generate_prompt("ls", None, None);
        assert!(!p.contains("Contexte"));
        assert!(!p.contains("Répertoire courant"));
    }

    #[test]
    fn chat_prompt_formats_conversation() {
        let p = build_chat_prompt(&[
            ChatMessage {
                role: "user".into(),
                content: "Qu'est-ce que ls ?".into(),
            },
            ChatMessage {
                role: "assistant".into(),
                content: "ls liste les fichiers.".into(),
            },
            ChatMessage {
                role: "user".into(),
                content: "Et -la ?".into(),
            },
        ]);
        assert!(p.contains("[USER]"));
        assert!(p.contains("[ASSISTANT]"));
        assert!(p.contains("Qu'est-ce que ls"));
        assert!(p.contains("Et -la"));
    }
}
