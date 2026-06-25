//! SSH manager: parses `~/.ssh/config` into a list of hosts the palette can
//! browse. Connecting just opens a new terminal that runs `ssh <host>`, so the
//! local shell handles auth/agent/known-hosts exactly as usual.

use std::path::PathBuf;

use serde::Serialize;

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SshHost {
    /// The `Host` alias — what you'd type as `ssh <name>`.
    pub name: String,
    pub host_name: Option<String>,
    pub user: Option<String>,
    pub port: Option<String>,
}

#[tauri::command]
pub fn list_ssh_hosts() -> Vec<SshHost> {
    read_ssh_config().map(|c| parse(&c)).unwrap_or_default()
}

fn read_ssh_config() -> Option<String> {
    let home = std::env::var_os("HOME")?;
    std::fs::read_to_string(PathBuf::from(home).join(".ssh").join("config")).ok()
}

fn parse(content: &str) -> Vec<SshHost> {
    let mut hosts: Vec<SshHost> = Vec::new();
    // Indices (into `hosts`) of the aliases declared by the current `Host` line;
    // subsequent HostName/User/Port lines apply to all of them.
    let mut current: Vec<usize> = Vec::new();

    for raw in content.lines() {
        let line = raw.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let (key, value) = split_kv(line);
        let key = key.to_ascii_lowercase();

        if key == "host" {
            current.clear();
            for alias in value.split_whitespace() {
                // Skip negations and patterns — they aren't concrete hosts.
                if alias.starts_with('!') || alias.contains('*') || alias.contains('?') {
                    continue;
                }
                hosts.push(SshHost {
                    name: alias.to_string(),
                    host_name: None,
                    user: None,
                    port: None,
                });
                current.push(hosts.len() - 1);
            }
        } else if !current.is_empty() && !value.is_empty() {
            for &i in &current {
                match key.as_str() {
                    "hostname" => hosts[i].host_name = Some(value.to_string()),
                    "user" => hosts[i].user = Some(value.to_string()),
                    "port" => hosts[i].port = Some(value.to_string()),
                    _ => {}
                }
            }
        }
    }

    hosts
}

/// Split an ssh_config line into keyword and value. The separator is whitespace
/// and/or a single `=` (both forms are valid in ssh_config).
fn split_kv(line: &str) -> (&str, &str) {
    match line.find(|c: char| c.is_whitespace() || c == '=') {
        Some(idx) => {
            let key = &line[..idx];
            let value = line[idx..]
                .trim_start_matches(|c: char| c.is_whitespace() || c == '=')
                .trim();
            (key, value)
        }
        None => (line, ""),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_hosts_and_options() {
        let cfg = "\
Host web prod-web
    HostName 10.0.0.1
    User deploy
    Port 2222

# a comment
Host db
    HostName db.internal
";
        let hosts = parse(cfg);
        assert_eq!(hosts.len(), 3); // web, prod-web, db
        let web = hosts.iter().find(|h| h.name == "web").unwrap();
        assert_eq!(web.host_name.as_deref(), Some("10.0.0.1"));
        assert_eq!(web.user.as_deref(), Some("deploy"));
        assert_eq!(web.port.as_deref(), Some("2222"));
        // The second alias on the same Host line shares the options.
        let pw = hosts.iter().find(|h| h.name == "prod-web").unwrap();
        assert_eq!(pw.user.as_deref(), Some("deploy"));
        let db = hosts.iter().find(|h| h.name == "db").unwrap();
        assert_eq!(db.host_name.as_deref(), Some("db.internal"));
        assert!(db.user.is_none());
    }

    #[test]
    fn skips_wildcard_hosts() {
        let cfg = "Host *\n    User root\nHost real\n    HostName x\n";
        let hosts = parse(cfg);
        assert_eq!(hosts.len(), 1);
        assert_eq!(hosts[0].name, "real");
    }

    #[test]
    fn handles_equals_separator() {
        let cfg = "Host=gateway\nHostName=gw.example.com\n";
        let hosts = parse(cfg);
        assert_eq!(hosts.len(), 1);
        assert_eq!(hosts[0].name, "gateway");
        assert_eq!(hosts[0].host_name.as_deref(), Some("gw.example.com"));
    }
}
