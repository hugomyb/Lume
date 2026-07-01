use serde::Serialize;

#[derive(Debug, Clone, PartialEq)]
pub enum OscEvent {
    PromptStart,
    PromptEnd,
    OutputStart,
    OutputEnd { exit_code: i32 },
    CommandLine(String),
    Cwd(String),
    /// Lume-specific (OSC 7733): the shell's alias list, base64-encoded as
    /// newline-separated `name\tvalue` rows. Emitted once at shell startup so
    /// the autocomplete can suggest the user's aliases.
    Aliases(String),
}

#[derive(Debug, Clone, PartialEq)]
pub struct TimedEvent {
    pub event: OscEvent,
    /// Byte position in `FeedResult::passthrough` at which this event fired.
    /// Bytes `[prev_idx .. this.passthrough_idx]` belong to the segment that
    /// preceded this event.
    pub passthrough_idx: usize,
}

/// Output of `OscParser::feed`. Contains the chunk minus OSC 133 markers
/// (which are stripped) and the list of events with their byte positions.
/// Non-133 OSC sequences are preserved in `passthrough` so they reach xterm.
#[derive(Debug, Clone, PartialEq)]
pub struct FeedResult {
    pub passthrough: Vec<u8>,
    pub events: Vec<TimedEvent>,
}

/// Streaming parser for OSC 133 (FinalTerm shell integration) sequences.
///
/// Recognises `ESC ] 133 ; X [ ; args ] ST` where ST is BEL (0x07) or `ESC \`.
/// Maintains state across `feed()` calls so sequences can straddle PTY reads.
pub struct OscParser {
    state: State,
    buf: Vec<u8>,
}

#[derive(Debug, Clone, Copy)]
enum State {
    Idle,
    SawEsc,
    InOsc,
    InOscSawEsc,
}

// Generous enough to hold a base64 alias dump (OSC 7733) for a large oh-my-zsh
// setup, while still bounding memory against a genuinely runaway sequence.
const MAX_OSC_LEN: usize = 1 << 16; // 64 KiB

impl OscParser {
    pub fn new() -> Self {
        Self {
            state: State::Idle,
            buf: Vec::new(),
        }
    }

    pub fn feed(&mut self, data: &[u8]) -> FeedResult {
        let mut passthrough = Vec::with_capacity(data.len());
        let mut events = Vec::new();
        for &b in data {
            match self.state {
                State::Idle => {
                    if b == 0x1b {
                        self.state = State::SawEsc;
                    } else {
                        passthrough.push(b);
                    }
                }
                State::SawEsc => {
                    if b == b']' {
                        self.state = State::InOsc;
                        self.buf.clear();
                    } else {
                        passthrough.push(0x1b);
                        passthrough.push(b);
                        self.state = State::Idle;
                    }
                }
                State::InOsc => {
                    if b == 0x07 {
                        finalize_osc(&self.buf, &mut passthrough, &mut events);
                        self.buf.clear();
                        self.state = State::Idle;
                    } else if b == 0x1b {
                        self.state = State::InOscSawEsc;
                    } else {
                        self.buf.push(b);
                        if self.buf.len() > MAX_OSC_LEN {
                            flush_runaway(&self.buf, &mut passthrough);
                            self.buf.clear();
                            self.state = State::Idle;
                        }
                    }
                }
                State::InOscSawEsc => {
                    if b == b'\\' {
                        finalize_osc(&self.buf, &mut passthrough, &mut events);
                        // For ESC \ terminator, append the same terminator to
                        // passthrough only if the sequence wasn't 133. But
                        // finalize_osc handled the non-133 passthrough emit
                        // with BEL terminator; we don't need ESC \ specifically
                        // — xterm accepts both.
                        self.buf.clear();
                        self.state = State::Idle;
                    } else {
                        self.buf.push(0x1b);
                        if self.buf.len() > MAX_OSC_LEN {
                            flush_runaway(&self.buf, &mut passthrough);
                            self.buf.clear();
                            self.state = State::Idle;
                        } else {
                            self.buf.push(b);
                            self.state = State::InOsc;
                        }
                    }
                }
            }
        }
        FeedResult {
            passthrough,
            events,
        }
    }
}

fn finalize_osc(buf: &[u8], passthrough: &mut Vec<u8>, events: &mut Vec<TimedEvent>) {
    let event = parse_osc(buf);
    // OSC 133;A (PromptStart) and 133;B (PromptEnd) are forwarded so xterm can
    // capture their buffer positions via `registerOscHandler`:
    //   - A pins the prompt's buffer line for the "click block → scroll" feature.
    //   - B marks the column where the command line begins, which the
    //     autocomplete uses as its anchor.
    // The remaining 133 markers are pure meta — strip them so they don't end up
    // in captured output or render artifacts. OSC 7 (Cwd) is also forwarded so
    // xterm/other consumers can use it.
    let consume = matches!(
        event,
        Some(
            OscEvent::OutputStart
                | OscEvent::OutputEnd { .. }
                | OscEvent::CommandLine(_)
                | OscEvent::Aliases(_)
        )
    );
    if let Some(event) = event {
        events.push(TimedEvent {
            event,
            passthrough_idx: passthrough.len(),
        });
    }
    if !consume {
        passthrough.push(0x1b);
        passthrough.push(b']');
        passthrough.extend_from_slice(buf);
        passthrough.push(0x07);
    }
}

fn flush_runaway(buf: &[u8], passthrough: &mut Vec<u8>) {
    passthrough.push(0x1b);
    passthrough.push(b']');
    passthrough.extend_from_slice(buf);
}

fn parse_osc(buf: &[u8]) -> Option<OscEvent> {
    let s = std::str::from_utf8(buf).ok()?;

    if let Some(rest) = s.strip_prefix("133;") {
        let (kind, payload) = match rest.split_once(';') {
            Some((k, p)) => (k, Some(p)),
            None => (rest, None),
        };
        return match kind {
            "A" => Some(OscEvent::PromptStart),
            "B" => Some(OscEvent::PromptEnd),
            "C" => Some(OscEvent::OutputStart),
            "D" => {
                let code = payload
                    .and_then(|s| s.split(';').next())
                    .and_then(|s| s.parse::<i32>().ok())
                    .unwrap_or(0);
                Some(OscEvent::OutputEnd { exit_code: code })
            }
            "E" => Some(OscEvent::CommandLine(payload.unwrap_or("").to_string())),
            _ => None,
        };
    }

    if let Some(rest) = s.strip_prefix("7733;") {
        return Some(OscEvent::Aliases(rest.to_string()));
    }

    if let Some(rest) = s.strip_prefix("7;") {
        // Format usually: file://hostname/path/to/dir
        // We tolerate plain paths too.
        let path = if let Some(after_scheme) = rest.strip_prefix("file://") {
            // Skip the hostname segment (everything before the first '/').
            match after_scheme.find('/') {
                Some(slash) => &after_scheme[slash..],
                None => after_scheme,
            }
        } else {
            rest
        };
        let decoded = normalize_cwd(percent_decode(path));
        return Some(OscEvent::Cwd(decoded));
    }

    None
}

/// `file://host/C:/path` decodes to `/C:/path`; strip the leading slash before
/// a Windows drive letter so it's a usable path. No-op for POSIX paths.
fn normalize_cwd(p: String) -> String {
    let b = p.as_bytes();
    if b.len() >= 3 && b[0] == b'/' && b[1].is_ascii_alphabetic() && b[2] == b':' {
        p[1..].to_string()
    } else {
        p
    }
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let h = (hex(bytes[i + 1]), hex(bytes[i + 2]));
            if let (Some(a), Some(b)) = h {
                out.push((a << 4) | b);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn hex(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BlockEvent {
    pub id: u64,
    pub kind: &'static str,
    pub exit_code: Option<i32>,
    pub command: Option<String>,
    pub output_b64: Option<String>,
}

impl BlockEvent {
    pub fn from_osc(id: u64, ev: OscEvent) -> Self {
        let base = Self {
            id,
            kind: "",
            exit_code: None,
            command: None,
            output_b64: None,
        };
        match ev {
            OscEvent::PromptStart => Self {
                kind: "promptStart",
                ..base
            },
            OscEvent::PromptEnd => Self {
                kind: "promptEnd",
                ..base
            },
            OscEvent::OutputStart => Self {
                kind: "outputStart",
                ..base
            },
            OscEvent::OutputEnd { exit_code } => Self {
                kind: "outputEnd",
                exit_code: Some(exit_code),
                ..base
            },
            OscEvent::CommandLine(cmd) => Self {
                kind: "commandLine",
                command: Some(cmd),
                ..base
            },
            OscEvent::Cwd(_) => Self {
                kind: "cwd",
                ..base
            },
            // Aliases are routed out-of-band in pty.rs (never reach here), but
            // the match must stay exhaustive.
            OscEvent::Aliases(_) => Self {
                kind: "aliases",
                ..base
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn events_only(r: &FeedResult) -> Vec<OscEvent> {
        r.events.iter().map(|te| te.event.clone()).collect()
    }

    #[test]
    fn detects_prompt_start_bel() {
        let mut p = OscParser::new();
        let r = p.feed(b"\x1b]133;A\x07");
        assert_eq!(events_only(&r), vec![OscEvent::PromptStart]);
        // 133;A is intentionally forwarded to xterm so it can pin the buffer
        // line of the prompt for click-to-scroll.
        assert_eq!(r.passthrough, b"\x1b]133;A\x07");
    }

    #[test]
    fn forwards_prompt_end_to_xterm() {
        let mut p = OscParser::new();
        let r = p.feed(b"\x1b]133;B\x07");
        assert_eq!(events_only(&r), vec![OscEvent::PromptEnd]);
        // 133;B is forwarded so xterm can capture the cursor column at the start
        // of the command line (autocomplete anchor).
        assert_eq!(r.passthrough, b"\x1b]133;B\x07");
    }

    #[test]
    fn detects_output_end_with_exit_code() {
        let mut p = OscParser::new();
        let r = p.feed(b"hello\x1b]133;D;42\x07world");
        assert_eq!(events_only(&r), vec![OscEvent::OutputEnd { exit_code: 42 }]);
        assert_eq!(r.passthrough, b"helloworld");
        assert_eq!(r.events[0].passthrough_idx, 5);
    }

    #[test]
    fn detects_st_escape_backslash() {
        let mut p = OscParser::new();
        let r = p.feed(b"\x1b]133;C\x1b\\");
        assert_eq!(events_only(&r), vec![OscEvent::OutputStart]);
    }

    #[test]
    fn straddles_reads() {
        let mut p = OscParser::new();
        let r1 = p.feed(b"\x1b]133");
        assert!(r1.events.is_empty());
        let r2 = p.feed(b";A\x07");
        assert_eq!(events_only(&r2), vec![OscEvent::PromptStart]);
    }

    #[test]
    fn preserves_non_133_oscs_in_passthrough() {
        let mut p = OscParser::new();
        let r = p.feed(b"\x1b]0;window title\x07after");
        assert!(r.events.is_empty());
        // The OSC 0 should be preserved verbatim with BEL terminator.
        assert_eq!(r.passthrough, b"\x1b]0;window title\x07after");
    }

    #[test]
    fn detects_cwd_from_osc7() {
        let mut p = OscParser::new();
        let r = p.feed(b"\x1b]7;file://machine/home/user/project\x07");
        assert_eq!(
            events_only(&r),
            vec![OscEvent::Cwd("/home/user/project".to_string())]
        );
        // OSC 7 is forwarded to xterm even though we captured it.
        assert!(r.passthrough.starts_with(b"\x1b]7;"));
    }

    #[test]
    fn normalizes_windows_drive_cwd() {
        let mut p = OscParser::new();
        let r = p.feed(b"\x1b]7;file://HOST/C:/Users/me\x07");
        assert_eq!(
            events_only(&r),
            vec![OscEvent::Cwd("C:/Users/me".to_string())]
        );
    }

    #[test]
    fn decodes_percent_in_cwd_path() {
        let mut p = OscParser::new();
        let r = p.feed(b"\x1b]7;file:///tmp/with%20space\x07");
        assert_eq!(
            events_only(&r),
            vec![OscEvent::Cwd("/tmp/with space".to_string())]
        );
    }

    #[test]
    fn detects_command_line_with_semicolons() {
        let mut p = OscParser::new();
        let r = p.feed(b"\x1b]133;E;ls -la; echo hi\x07");
        assert_eq!(
            events_only(&r),
            vec![OscEvent::CommandLine("ls -la; echo hi".to_string())]
        );
    }

    #[test]
    fn detects_empty_command_line() {
        let mut p = OscParser::new();
        let r = p.feed(b"\x1b]133;E;\x07");
        assert_eq!(events_only(&r), vec![OscEvent::CommandLine("".to_string())]);
    }

    #[test]
    fn caps_buffer_on_runaway() {
        let mut p = OscParser::new();
        let mut bytes = vec![0x1b, b']'];
        bytes.extend(std::iter::repeat(b'a').take(MAX_OSC_LEN + 100));
        let r = p.feed(&bytes);
        assert!(r.events.is_empty());
        // After runaway, parser should accept new sequences again
        let r2 = p.feed(b"\x1b]133;A\x07");
        assert_eq!(events_only(&r2), vec![OscEvent::PromptStart]);
    }

    #[test]
    fn captures_output_between_c_and_d() {
        let mut p = OscParser::new();
        let r = p.feed(b"\x1b]133;C\x07hello world\x1b]133;D;0\x07");
        let e = events_only(&r);
        assert_eq!(
            e,
            vec![OscEvent::OutputStart, OscEvent::OutputEnd { exit_code: 0 }]
        );
        assert_eq!(r.passthrough, b"hello world");
        // OutputStart fires at position 0, OutputEnd at position 11 ("hello world".len())
        assert_eq!(r.events[0].passthrough_idx, 0);
        assert_eq!(r.events[1].passthrough_idx, 11);
    }
}
