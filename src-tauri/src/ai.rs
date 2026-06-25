use std::collections::HashMap;
use std::io::Read;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::thread;

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

use crate::pty::{pty_cwd, PtyManager};

const MAX_OUTPUT_CHARS: usize = 8000;

#[derive(Default)]
pub struct AiManager {
    next_id: AtomicU64,
    /// Active child processes, keyed by request id, for cancellation.
    children: Mutex<HashMap<u64, std::process::Child>>,
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
}

#[tauri::command]
pub fn ai_status() -> AiStatus {
    let path = which_claude();
    AiStatus {
        available: path.is_some(),
        path,
    }
}

fn which_claude() -> Option<String> {
    let output = Command::new("sh")
        .arg("-c")
        .arg("command -v claude")
        .stderr(Stdio::null())
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let s = String::from_utf8_lossy(&output.stdout)
        .trim()
        .to_string();
    if s.is_empty() {
        None
    } else {
        Some(s)
    }
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
    command: String,
    output: Option<String>,
    exit_code: i32,
) -> Result<u64, String> {
    let prompt = build_prompt(&command, output.as_deref().unwrap_or(""), exit_code);
    spawn_claude_request(app, state, prompt)
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

fn build_chat_prompt(messages: &[ChatMessage]) -> String {
    let mut p = String::new();
    p.push_str("Tu es Claude, intégré dans le terminal Lume. Tu réponds à la dernière question de l'utilisateur en t'appuyant sur la conversation ci-dessous.\n\n");
    p.push_str("---\n");
    for msg in messages.iter() {
        let label = match msg.role.as_str() {
            "user" => "USER",
            "assistant" => "CLAUDE",
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
    messages: Vec<ChatMessage>,
) -> Result<u64, String> {
    if messages.is_empty() {
        return Err("ai_chat: empty messages".to_string());
    }
    let prompt = build_chat_prompt(&messages);
    spawn_claude_request(app, state, prompt)
}

#[tauri::command]
pub fn ai_generate_command(
    app: AppHandle,
    state: State<'_, Arc<AiManager>>,
    pty_state: State<'_, Arc<PtyManager>>,
    query: String,
    pty_id: Option<u64>,
) -> Result<u64, String> {
    let cwd = pty_id.and_then(|id| pty_cwd(pty_state.inner(), id));
    let listing = cwd.as_deref().and_then(sample_directory);
    let prompt = build_generate_prompt(&query, cwd.as_deref(), listing.as_deref());
    spawn_claude_request(app, state, prompt)
}

fn spawn_claude_request(
    app: AppHandle,
    state: State<'_, Arc<AiManager>>,
    prompt: String,
) -> Result<u64, String> {
    let claude_path = which_claude().ok_or_else(|| {
        "claude CLI introuvable dans PATH. Installe Claude Code, puis `claude login`.".to_string()
    })?;

    let request_id = state.next_id.fetch_add(1, Ordering::Relaxed);

    let mut child = Command::new(&claude_path)
        .arg("-p")
        .arg(&prompt)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("spawn claude: {e}"))?;

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
                    "claude CLI a échoué (vérifie `claude login`)".to_string()
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
            Some("/home/hugo/projects/lume"),
            Some("dossiers : src-tauri/ src/\nfichiers : package.json"),
        );
        assert!(p.contains("Répertoire courant : /home/hugo/projects/lume"));
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
        assert!(p.contains("[CLAUDE]"));
        assert!(p.contains("Qu'est-ce que ls"));
        assert!(p.contains("Et -la"));
    }
}
