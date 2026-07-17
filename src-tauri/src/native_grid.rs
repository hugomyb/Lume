//! Native terminal grid renderer (Linux) — docs/native-renderer-plan.md.
//!
//! Each visible pane gets a GtkDrawingArea painted with pango/cairo from a
//! Rust-side `alacritty_terminal` model fed by the PTY broadcast. The stack,
//! bottom to top, inside a GtkOverlay that replaces tao's default vbox:
//!
//!   background painter → GtkFixed(grid areas) → WebView (transparent)
//!
//! The web layer keeps input, layout and all chrome; DOM overlays (popups,
//! panels, modals) naturally draw above the grid. xterm.js still runs as the
//! interaction model but its canvases are hidden while the native grid is
//! active; the frontend reveals them again for the cases the grid doesn't
//! cover (active selection, scrolled-back viewport, search) — see
//! Terminal.tsx.
//!
//! Measured pty→pixel: ~1-4 ms (vs ~14 ms through WebKit's compositor).
//!
//! IMPORTANT (wry): the undecorated-resize handler resolves the toplevel as
//! `webview.parent().parent()` and unwrap-downcasts it to GtkWindow on every
//! left click, so the overlay must sit DIRECTLY under the GtkWindow with the
//! webview as its direct child — never nest the webview one level deeper.

#![cfg(target_os = "linux")]

use std::cell::RefCell;
use std::collections::HashMap;
use std::sync::{Arc, OnceLock};

use alacritty_terminal::event::{Event, EventListener};
use alacritty_terminal::grid::{Dimensions, Scroll};
use alacritty_terminal::term::cell::Flags;
use alacritty_terminal::term::{Config as TermConfig, Term};
use alacritty_terminal::vte::ansi::{Color, NamedColor, Processor};
use gtk::prelude::*;
use parking_lot::Mutex;
use serde::Deserialize;
use tauri::{Manager, State};

use crate::pty::PtyManager;

// ---------------------------------------------------------------------------
// Model side (any thread)
// ---------------------------------------------------------------------------

struct GridSize {
    columns: usize,
    screen_lines: usize,
}

impl Dimensions for GridSize {
    fn total_lines(&self) -> usize {
        self.screen_lines
    }
    fn screen_lines(&self) -> usize {
        self.screen_lines
    }
    fn columns(&self) -> usize {
        self.columns
    }
}

#[derive(Clone, Copy)]
struct NoopListener;

impl EventListener for NoopListener {
    fn send_event(&self, _event: Event) {}
}

type Rgb = (f64, f64, f64);

fn parse_hex(s: &str, fallback: Rgb) -> Rgb {
    let h = s.trim_start_matches('#');
    if h.len() < 6 {
        return fallback;
    }
    let p = |i: usize| u8::from_str_radix(&h[i..i + 2], 16).unwrap_or(0) as f64 / 255.0;
    (p(0), p(2), p(4))
}

/// Palette + metrics shared between the feed task and the draw handler.
struct GridStyle {
    cell_w: f64,
    cell_h: f64,
    font: String,
    font_px: f64,
    fg: Rgb,
    bg: Rgb,
    cursor: Rgb,
    selection: Rgb,
    ansi: [Rgb; 16],
}

struct GridModel {
    term: Mutex<Term<NoopListener>>,
    parser: Mutex<Processor>,
    style: Mutex<GridStyle>,
    /// Bumped on every reattach so a stale feed task for the same pty exits.
    generation: Mutex<u64>,
    /// Only the focused pane draws its cursor (mirrors the web focus).
    focused: Mutex<bool>,
    /// Pane rect in window coordinates (x, y, w, h) and its visibility.
    rect: Mutex<(i32, i32, i32, i32)>,
    visible: Mutex<bool>,
    /// Active selection in viewport coords (start_row, start_col,
    /// end_row, end_col_exclusive), linewise — mirrored from xterm, which
    /// stays the owner of the selection state (copy/PRIMARY unchanged).
    selection: Mutex<Option<(i32, i32, i32, i32)>>,
    /// Viewport rows the grid must NOT paint: the DOM block bars live there
    /// and show through the unpainted (windowless) area with full
    /// interactivity — no need to re-render them natively.
    holes: Mutex<Vec<usize>>,
    /// Byte-offset bookkeeping for dump-based resyncs (see StreamSync).
    stream: Mutex<StreamSync>,
    /// Scrollback depth, mirroring xterm's configured scrollback: the JS
    /// side mirrors xterm's viewport offset into this model, so both
    /// histories must hold the same number of lines.
    history: Mutex<usize>,
}

/// Lines the model's byte stream up with xterm's. The PTY reader feeds this
/// model directly (Rust-side, low latency) and xterm through the JS channel —
/// the model is normally AHEAD. A resync dump serialized from xterm therefore
/// misses bytes the model has already applied; blindly rebuilding from it
/// would lose them forever (stale prompts resurrected, fresh output dropped).
/// Both consumers count the same absolute passthrough-byte offset, and the
/// model keeps a capped ring of recent bytes so a rebuild can replay exactly
/// the span the dump hasn't seen: rebuild(state@J) + ring[J..rx_pos] ==
/// state@rx_pos, byte-exact.
struct StreamSync {
    /// Absolute offset of the next byte expected from the broadcast feed.
    rx_pos: u64,
    /// Everything below this absolute offset is already in the model —
    /// feed chunks under it are skipped (covered by a dump rebuild).
    applied: u64,
    /// Absolute offset of ring[0].
    ring_base: u64,
    ring: Vec<u8>,
    /// The broadcast lagged (chunks lost, byte counts unknowable): offsets
    /// are re-anchored on the next dump rebuild.
    lagged: bool,
}

/// Ring capacity: must comfortably cover the bytes a shell can emit between
/// xterm serializing its buffer and the rebuild applying it (milliseconds).
const STREAM_RING_CAP: usize = 256 * 1024;

impl GridModel {
    fn color(&self, style: &GridStyle, color: Color, is_fg: bool) -> Rgb {
        match color {
            Color::Spec(rgb) => (
                rgb.r as f64 / 255.0,
                rgb.g as f64 / 255.0,
                rgb.b as f64 / 255.0,
            ),
            Color::Named(NamedColor::Foreground) => style.fg,
            Color::Named(NamedColor::Background) => style.bg,
            Color::Named(NamedColor::Cursor) => style.cursor,
            Color::Named(named) => {
                let idx = named as usize;
                if idx < 16 {
                    style.ansi[idx]
                } else if is_fg {
                    style.fg
                } else {
                    style.bg
                }
            }
            Color::Indexed(i) => {
                let i = i as usize;
                if i < 16 {
                    style.ansi[i]
                } else if i < 232 {
                    let i = i - 16;
                    let comp = |v: usize| {
                        if v == 0 {
                            0.0
                        } else {
                            (55 + 40 * v) as f64 / 255.0
                        }
                    };
                    (comp(i / 36), comp((i / 6) % 6), comp(i % 6))
                } else {
                    let g = (8 + 10 * (i.min(255) - 232)) as f64 / 255.0;
                    (g, g, g)
                }
            }
        }
    }
}

/// Window-coordinate rects of DOM affordances currently shown over panes
/// (drag grip, copy button, context menus…): the grid leaves them unpainted
/// so the web layer shows through, fully interactive.
static OVERLAY_RECTS: Mutex<Vec<(i32, i32, i32, i32)>> = Mutex::new(Vec::new());

fn models() -> &'static Mutex<HashMap<u64, Arc<GridModel>>> {
    static MODELS: OnceLock<Mutex<HashMap<u64, Arc<GridModel>>>> = OnceLock::new();
    MODELS.get_or_init(|| Mutex::new(HashMap::new()))
}

// ---------------------------------------------------------------------------
// UI side (main thread only)
// ---------------------------------------------------------------------------

thread_local! {
    /// The toplevel we hooked (main thread only).
    static HOOKED: RefCell<Option<gtk::ApplicationWindow>> = const { RefCell::new(None) };
    static CURSOR_ON: std::cell::Cell<bool> = const { std::cell::Cell::new(true) };
}

/// Redraw request sent from the feed task to the main thread.
/// `None` lines = full redraw of the pane rect.
struct Redraw {
    id: u64,
    lines: Option<Vec<(usize, usize)>>,
}

/// Queue a repaint of a model's rect on the toplevel (main thread).
/// Always full-rect: per-line strips painted while cell metrics/rects churn
/// (pane resize) land at inconsistent offsets and nothing ever repaints
/// them — full repaints are self-consistent by construction and cheap
/// (~1-3 ms of pango for a typical pane, event-driven only).
fn queue_model_redraw(model: &GridModel, _lines: Option<&[(usize, usize)]>) {
    if !*model.visible.lock() {
        return;
    }
    let (x, y, w, h) = *model.rect.lock();
    HOOKED.with(|hw| {
        if let Some(win) = hw.borrow().as_ref() {
            win.queue_draw_area(x, y, w, h);
        }
    });
}

fn ensure_glib_bridge() -> std::sync::mpsc::Sender<Redraw> {
    static TX: OnceLock<std::sync::mpsc::Sender<Redraw>> = OnceLock::new();
    TX.get_or_init(|| {
        #[allow(deprecated)] // fine on glib 0.18
        let (gtx, grx) = gtk::glib::MainContext::channel::<Redraw>(gtk::glib::Priority::HIGH);
        grx.attach(None, move |req: Redraw| {
            if let Some(model) = models().lock().get(&req.id).cloned() {
                queue_model_redraw(&model, req.lines.as_deref());
            }
            gtk::glib::ControlFlow::Continue
        });
        let (tx, rx) = std::sync::mpsc::channel::<Redraw>();
        std::thread::spawn(move || {
            while let Ok(req) = rx.recv() {
                if gtx.send(req).is_err() {
                    break;
                }
            }
        });
        tx
    })
    .clone()
}

/// Hook the toplevel once: paint every visible grid AFTER GTK drew the
/// children (webview included) — same effect as an overlay widget, but with
/// ZERO hierarchy changes, so input focus and wry's assumptions are untouched.
/// Also starts the shared cursor-blink timer.
fn ensure_draw_hook(window: &tauri::WebviewWindow, blink: bool) -> bool {
    if HOOKED.with(|h| h.borrow().is_some()) {
        return true;
    }
    let Ok(gtk_window) = window.gtk_window() else {
        eprintln!("[native-grid] no gtk window");
        return false;
    };
    // gtk3-rs doesn't expose connect_draw_after; hook the "draw" signal with
    // after=true so we paint once every child (webview included) has drawn.
    gtk_window.connect_local("draw", true, |values| {
        let Ok(cr) = values[1].get::<gtk::cairo::Context>() else {
            return Some(false.to_value());
        };
        let cr = &cr;
        let list: Vec<Arc<GridModel>> = models().lock().values().cloned().collect();
        let cursor_on = CURSOR_ON.with(|c| c.get());
        let debug = std::env::var_os("LUME_GRID_DEBUG").is_some();
        for model in list {
            if debug {
                eprintln!(
                    "[grid-draw] rect={:?} visible={} holes={:?}",
                    *model.rect.lock(),
                    *model.visible.lock(),
                    *model.holes.lock()
                );
            }
            if !*model.visible.lock() {
                continue;
            }
            let (x, y, w, h) = *model.rect.lock();
            if w <= 0 || h <= 0 {
                continue;
            }
            cr.save().ok();
            // Pane clip minus the DOM overlay rects (even-odd fill rule:
            // regions covered twice are excluded). Holes must be intersected
            // with the pane rect first — an even-odd rect sticking out would
            // ADD area outside the pane instead of subtracting.
            cr.set_fill_rule(gtk::cairo::FillRule::EvenOdd);
            cr.rectangle(x as f64, y as f64, w as f64, h as f64);
            for &(ox, oy, ow, oh) in OVERLAY_RECTS.lock().iter() {
                let ix = ox.max(x);
                let iy = oy.max(y);
                let ix2 = (ox + ow).min(x + w);
                let iy2 = (oy + oh).min(y + h);
                if ix2 > ix && iy2 > iy {
                    cr.rectangle(ix as f64, iy as f64, (ix2 - ix) as f64, (iy2 - iy) as f64);
                }
            }
            cr.clip();
            cr.set_fill_rule(gtk::cairo::FillRule::Winding);
            cr.translate(x as f64, y as f64);
            let clip = cr
                .clip_extents()
                .unwrap_or((0.0, 0.0, w as f64, h as f64));
            draw_grid(
                &model,
                cursor_on,
                cr,
                (clip.0, clip.1, clip.2 - clip.0, clip.3 - clip.1),
            );
            cr.restore().ok();
        }
        Some(false.to_value())
    });
    if blink {
        gtk::glib::timeout_add_local(std::time::Duration::from_millis(530), move || {
            CURSOR_ON.with(|c| c.set(!c.get()));
            let list: Vec<Arc<GridModel>> = models().lock().values().cloned().collect();
            for model in list {
                if *model.focused.lock() && *model.visible.lock() {
                    let row = {
                        let term = model.term.lock();
                        term.renderable_content().cursor.point.line.0.max(0) as usize
                    };
                    queue_model_redraw(&model, Some(&[(row, row)]));
                }
            }
            gtk::glib::ControlFlow::Continue
        });
    }
    HOOKED.with(|h| *h.borrow_mut() = Some(gtk_window));
    true
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

fn draw_grid(model: &GridModel, cursor_on: bool, cr: &gtk::cairo::Context, clip: (f64, f64, f64, f64)) {
    let style = model.style.lock();
    let term = model.term.lock();
    let content = term.renderable_content();
    let offset = content.display_offset as i32;
    let cursor = content.cursor.point;
    let (cell_w, cell_h) = (style.cell_w, style.cell_h);

    // Degenerate metrics (hidden pane attached at 0x0) would turn the row
    // loop into a runaway: bail out, native_grid_update fixes the dims when
    // the pane gets real geometry.
    if cell_w < 0.5 || cell_h < 0.5 {
        return;
    }
    let rows_total = term.screen_lines() as i32;
    let holes = model.holes.lock().clone();
    let selection = *model.selection.lock();
    let first_row = ((clip.1 / cell_h).floor().max(0.0) as i32).min(rows_total);
    let last_row = (((clip.1 + clip.3) / cell_h).ceil() as i32).clamp(0, rows_total);

    // Opaque background, painted per row so hole rows (DOM block bars) stay
    // untouched and show the web layer through.
    cr.set_source_rgb(style.bg.0, style.bg.1, style.bg.2);
    for row in first_row..=last_row {
        if holes.contains(&(row.max(0) as usize)) {
            continue;
        }
        cr.rectangle(clip.0, row as f64 * cell_h, clip.2, cell_h + 0.5);
    }
    let _ = cr.fill();

    let layout = pangocairo::functions::create_layout(cr);
    // set_family, NOT from_string: pango parses trailing words of the string
    // as style/size hints ("MesloLGS NF" -> family "MesloLGS" + unknown "NF")
    // and silently falls back to a font without the nerd/powerline glyphs.
    let mut desc = gtk::pango::FontDescription::new();
    // Secondary family matches the web renderer's tail fallback: icon
    // codepoints missing from the user's font resolve to Unifont CSUR's
    // real glyphs instead of Unifont Sample's hex-boxes ("tofu").
    desc.set_family(&format!("{},Unifont CSUR", style.font));
    desc.set_absolute_size(style.font_px * gtk::pango::SCALE as f64);
    layout.set_font_description(Some(&desc));
    let mut bold_desc = desc.clone();
    bold_desc.set_weight(gtk::pango::Weight::Bold);

    for indexed in content.display_iter {
        let row = indexed.point.line.0 + offset;
        if row < first_row || row > last_row || holes.contains(&(row.max(0) as usize)) {
            continue;
        }
        let col = indexed.point.column.0;
        let cell = &*indexed;
        if cell.flags.contains(Flags::WIDE_CHAR_SPACER) {
            continue;
        }
        let cx = col as f64 * cell_w;
        let cy = row as f64 * cell_h;
        let wide = cell.flags.contains(Flags::WIDE_CHAR);
        let cw = if wide { cell_w * 2.0 } else { cell_w };

        let (mut fg, mut bg) = (
            model.color(&style, cell.fg, true),
            model.color(&style, cell.bg, false),
        );
        if cell.flags.contains(Flags::INVERSE) {
            std::mem::swap(&mut fg, &mut bg);
        }
        if let Some((sr, sc, er, ec)) = selection {
            let c = col as i32;
            let in_sel = if row < sr || row > er {
                false
            } else if sr == er {
                c >= sc && c < ec
            } else if row == sr {
                c >= sc
            } else if row == er {
                c < ec
            } else {
                true
            };
            if in_sel {
                bg = style.selection;
            }
        }
        let is_cursor = cursor_on
            && *model.focused.lock()
            && offset == 0
            && indexed.point.line == cursor.line
            && indexed.point.column == cursor.column;
        if is_cursor {
            bg = style.cursor;
            fg = style.bg;
        }

        if bg != style.bg {
            cr.set_source_rgb(bg.0, bg.1, bg.2);
            cr.rectangle(cx, cy, cw + 0.5, cell_h + 0.5);
            let _ = cr.fill();
        }

        let ch = cell.c;
        if std::env::var_os("LUME_GRID_DEBUG").is_some() && (ch as u32) > 0x2000 {
            eprintln!("[grid-glyph] U+{:04X}", ch as u32);
        }
        if ch != ' ' && ch != '\0' {
            let dim = cell.flags.contains(Flags::DIM);
            cr.set_source_rgba(fg.0, fg.1, fg.2, if dim { 0.6 } else { 1.0 });
            let mut buf = [0u8; 4];
            layout.set_font_description(Some(if cell.flags.contains(Flags::BOLD) {
                &bold_desc
            } else {
                &desc
            }));
            layout.set_text(ch.encode_utf8(&mut buf));
            cr.move_to(cx, cy);
            pangocairo::functions::show_layout(cr, &layout);
        }
        if cell.flags.contains(Flags::UNDERLINE) {
            cr.set_source_rgb(fg.0, fg.1, fg.2);
            cr.rectangle(cx, cy + cell_h - 1.5, cw, 1.0);
            let _ = cr.fill();
        }
    }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GridTheme {
    background: String,
    foreground: String,
    cursor: String,
    selection: String,
    ansi: Vec<String>,
}

/// Feed a model from a live PTY subscription until its generation changes.
fn spawn_feed(
    window: tauri::WebviewWindow,
    model: Arc<GridModel>,
    id: u64,
    generation: u64,
    mut rx: tokio::sync::broadcast::Receiver<Vec<u8>>,
) {
    let tx = move || -> Option<std::sync::mpsc::Sender<Redraw>> {
        let (otx, orx) = std::sync::mpsc::channel();
        let _ = window.run_on_main_thread(move || {
            let _ = otx.send(ensure_glib_bridge());
        });
        orx.recv().ok()
    };
    tauri::async_runtime::spawn(async move {
        let Some(tx) = tx() else { return };
        loop {
            match rx.recv().await {
                Ok(bytes) => {
                    if *model.generation.lock() != generation {
                        break; // replaced by a newer attach/resync
                    }
                    if std::env::var_os("LUME_GRID_DEBUG").is_some() {
                        eprintln!("[grid-feed] id={id} +{}B", bytes.len());
                    }
                    {
                        let mut term = model.term.lock();
                        let mut parser = model.parser.lock();
                        let mut st = model.stream.lock();
                        let start = st.rx_pos;
                        st.ring.extend_from_slice(&bytes);
                        let overflow = st.ring.len().saturating_sub(STREAM_RING_CAP);
                        if overflow > 0 {
                            st.ring.drain(..overflow);
                            st.ring_base += overflow as u64;
                        }
                        st.rx_pos = start + bytes.len() as u64;
                        // Skip any prefix a dump rebuild already covered.
                        if st.rx_pos > st.applied {
                            let skip = st.applied.saturating_sub(start) as usize;
                            parser.advance(&mut *term, &bytes[skip..]);
                            st.applied = st.rx_pos;
                            term.reset_damage();
                        }
                    }
                    if tx.send(Redraw { id, lines: None }).is_err() {
                        break;
                    }
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => {
                    model.stream.lock().lagged = true;
                    let _ = tx.send(Redraw { id, lines: None });
                }
                Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
            }
        }
    });
}

/// Attach (or re-attach) a native grid for PTY `id`.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn native_grid_attach(
    app: tauri::AppHandle,
    pty_state: State<'_, Arc<PtyManager>>,
    id: u64,
    x: i32,
    y: i32,
    width: i32,
    height: i32,
    cols: u16,
    rows: u16,
    cell_w: f64,
    cell_h: f64,
    font_family: String,
    font_px: f64,
    cursor_blink: bool,
    history: u32,
    theme: GridTheme,
) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or("main window not found")?;
    let (snapshot, snap_end, rx) = pty_state.attach(id).ok_or("unknown pty id")?;

    let cols = (cols as usize).max(2);
    let rows = (rows as usize).max(2);
    let style = GridStyle {
        // Prefer xterm's exact cell metrics so both renderings share one
        // glyph grid; fall back to the rect division when unknown.
        cell_w: if cell_w > 0.5 { cell_w } else { width as f64 / cols as f64 },
        cell_h: if cell_h > 0.5 { cell_h } else { height as f64 / rows as f64 },
        font: font_family,
        font_px,
        fg: parse_hex(&theme.foreground, (0.9, 0.9, 0.9)),
        bg: parse_hex(&theme.background, (0.06, 0.06, 0.09)),
        cursor: parse_hex(&theme.cursor, (0.9, 0.9, 0.9)),
        selection: parse_hex(&theme.selection, (0.16, 0.20, 0.34)),
        ansi: {
            let mut a = [(0.0, 0.0, 0.0); 16];
            for (i, slot) in a.iter_mut().enumerate() {
                *slot = parse_hex(
                    theme.ansi.get(i).map(String::as_str).unwrap_or(""),
                    if i < 8 { (0.2, 0.2, 0.2) } else { (0.8, 0.8, 0.8) },
                );
            }
            a
        },
    };
    
    // Replace any previous model for this pty (respawn / re-attach).
    let generation;
    let model = {
        let mut map = models().lock();
        if let Some(old) = map.get(&id) {
            *old.generation.lock() += 1;
        }
        let model = Arc::new(GridModel {
            term: Mutex::new(Term::new(
                TermConfig {
                    scrolling_history: history as usize,
                    ..TermConfig::default()
                },
                &GridSize {
                    columns: cols,
                    screen_lines: rows,
                },
                NoopListener,
            )),
            parser: Mutex::new(Processor::new()),
            style: Mutex::new(style),
            generation: Mutex::new(0),
            focused: Mutex::new(false),
            rect: Mutex::new((x, y, width, height)),
            visible: Mutex::new(true),
            selection: Mutex::new(None),
            holes: Mutex::new(Vec::new()),
            stream: Mutex::new(StreamSync {
                rx_pos: snap_end,
                applied: snap_end,
                // Seed the ring with the snapshot itself: an early dump can
                // predate the attach point and still replay across it.
                ring_base: snap_end - snapshot.len() as u64,
                ring: snapshot.clone(),
                lagged: false,
            }),
            history: Mutex::new(history as usize),
        });
        generation = 0u64;
        map.insert(id, model.clone());
        model
    };

    {
        let mut term = model.term.lock();
        let mut parser = model.parser.lock();
        parser.advance(&mut *term, &snapshot);
        term.reset_damage();
    }
    if std::env::var_os("LUME_GRID_DEBUG").is_some() {
        eprintln!("[grid-attach] id={id} snapshot={}B grid={cols}x{rows}", snapshot.len());
    }

    // UI hook on the main thread (idempotent) + first paint.
    {
        let window_ui = window.clone();
        let model_ui = model.clone();
        window
            .run_on_main_thread(move || {
                if ensure_draw_hook(&window_ui, cursor_blink) {
                    let _ = ensure_glib_bridge();
                    queue_model_redraw(&model_ui, None);
                }
            })
            .map_err(|e| e.to_string())?;
    }

    // Feed task: PTY broadcast -> model -> redraw requests.
    spawn_feed(window.clone(), model, id, generation, rx);

    Ok(())
}

/// Move/resize a pane's grid (pane layout changed).
///
/// When `dump` is provided (a serialized snapshot of xterm's live viewport,
/// SGR included), the model is rebuilt from it at the new dimensions: xterm
/// and alacritty rewrap buffers differently on resize, so resizing the model
/// in place drifts its rows away from xterm's (mispositioned text vs the DOM
/// block bars, lines lost on shrink/grow cycles). The dump IS xterm's
/// post-reflow truth. Without a dump, dimension changes fall back to an
/// in-place resize. (A replay of the raw PTY bytes is NOT an alternative:
/// cursor-relative prompt redraws are only valid at their original width and
/// stack one prompt copy per redraw.)
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn native_grid_update(
    app: tauri::AppHandle,
    id: u64,
    x: i32,
    y: i32,
    width: i32,
    height: i32,
    cols: u16,
    rows: u16,
    cell_w: f64,
    cell_h: f64,
    dump: Option<String>,
    dump_offset: Option<u64>,
) -> Result<(), String> {
    let cols = (cols as usize).max(2);
    let rows = (rows as usize).max(2);
    let window = app
        .get_webview_window("main")
        .ok_or("main window not found")?;
    if let Some(model) = models().lock().get(&id).cloned() {
        let old_rect = {
            let mut style = model.style.lock();
            style.cell_w = if cell_w > 0.5 {
                cell_w
            } else {
                width as f64 / cols as f64
            };
            style.cell_h = if cell_h > 0.5 {
                cell_h
            } else {
                height as f64 / rows as f64
            };
            let mut rect = model.rect.lock();
            let old = *rect;
            *rect = (x, y, width, height);
            old
        };
        let dims_changed = {
            let term = model.term.lock();
            term.screen_lines() != rows || term.columns() != cols
        };
        if let Some(dump) = dump.as_ref() {
            // Rebuild from xterm's serialized viewport: fresh grid at the
            // final dims, then replay the dump (absolute content, valid at
            // exactly these dims). The model normally runs AHEAD of xterm
            // (it's fed Rust-side), so the dump alone would lose the bytes
            // applied since xterm's serialize: replay them from the ring
            // (see StreamSync) to land byte-exactly on the model's stream
            // position. The live feed keeps appending afterwards.
            let mut term = model.term.lock();
            let mut parser = model.parser.lock();
            let mut st = model.stream.lock();
            // The user may be scrolled back: carry the display offset over
            // to the rebuilt model (clamped by alacritty if now out of
            // range). JS re-mirrors the exact offset right after.
            let display_offset = term.grid().display_offset();
            *term = Term::new(
                TermConfig {
                    scrolling_history: *model.history.lock(),
                    ..TermConfig::default()
                },
                &GridSize {
                    columns: cols,
                    screen_lines: rows,
                },
                NoopListener,
            );
            *parser = Processor::new();
            parser.advance(&mut *term, dump.as_bytes());
            if display_offset > 0 {
                term.scroll_display(Scroll::Delta(display_offset as i32));
            }
            // Stale selection coords are meaningless against the rebuilt
            // buffer; JS re-mirrors the real selection right after.
            *model.selection.lock() = None;
            let j = dump_offset.unwrap_or(st.rx_pos);
            if st.lagged {
                // Byte counts are unknowable after a broadcast lag: the dump
                // re-anchors the whole accounting.
                st.rx_pos = j;
                st.applied = j;
                st.ring_base = j;
                st.ring.clear();
                st.lagged = false;
            } else if j <= st.rx_pos {
                if j >= st.ring_base {
                    let from = (j - st.ring_base) as usize;
                    if from < st.ring.len() {
                        let delta = st.ring[from..].to_vec();
                        parser.advance(&mut *term, &delta);
                    }
                } else if std::env::var_os("LUME_GRID_DEBUG").is_some() {
                    // Dump older than the ring (>256 KiB since serialize):
                    // accept the dump as-is; the next quiet dump heals.
                    eprintln!("[grid-update] id={id} dump@{j} below ring base");
                }
                st.applied = st.rx_pos;
            } else {
                // Dump is AHEAD of the feed (xterm saw bytes still in flight
                // to us): skip incoming chunks up to the dump's offset.
                st.applied = j;
            }
        } else if dims_changed {
            model.term.lock().resize(GridSize {
                columns: cols,
                screen_lines: rows,
            });
        }
        let rect_changed = old_rect != (x, y, width, height);
        if std::env::var_os("LUME_GRID_DEBUG").is_some() {
            eprintln!(
                "[grid-update] id={id} rect={old_rect:?}->({x},{y},{width},{height}) grid={cols}x{rows} dims_changed={dims_changed} dump={}B",
                dump.as_ref().map_or(0, |d| d.len())
            );
        }
        window
            .run_on_main_thread(move || {
                if rect_changed || dims_changed {
                    // Layout moved: full-window repaint wipes any pixels the
                    // grid left at intermediate positions.
                    HOOKED.with(|hw| {
                        if let Some(win) = hw.borrow().as_ref() {
                            win.queue_draw();
                        }
                    });
                } else {
                    queue_model_redraw(&model, None);
                }
            })
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Mirror xterm's viewport scroll offset (0 = bottom, live view). The grid
/// paints its own scrollback at this offset — scrolled-back viewing is fully
/// native, xterm is never revealed.
#[tauri::command]
pub fn native_grid_set_offset(app: tauri::AppHandle, id: u64, offset: u32) -> Result<(), String> {
    if let Some(model) = models().lock().get(&id).cloned() {
        {
            let mut term = model.term.lock();
            let current = term.grid().display_offset();
            let delta = offset as i64 - current as i64;
            if delta != 0 {
                term.scroll_display(Scroll::Delta(delta as i32));
            } else {
                return Ok(());
            }
        }
        let window = app
            .get_webview_window("main")
            .ok_or("main window not found")?;
        window
            .run_on_main_thread(move || queue_model_redraw(&model, None))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Show/hide a pane's grid (tab switched / web overlay needs the spot).
#[tauri::command]
pub fn native_grid_set_visible(app: tauri::AppHandle, id: u64, visible: bool) -> Result<(), String> {
    if let Some(model) = models().lock().get(&id).cloned() {
        if std::env::var_os("LUME_GRID_DEBUG").is_some() {
            eprintln!("[grid-visible] id={id} visible={visible}");
        }
        *model.visible.lock() = visible;
        let window = app
            .get_webview_window("main")
            .ok_or("main window not found")?;
        window
            .run_on_main_thread(move || {
                // Full-window repaint: cheap (event-driven only) and it
                // guarantees no stale grid pixels survive anywhere — pane
                // rects may have moved while this grid was hidden.
                HOOKED.with(|hw| {
                    if let Some(win) = hw.borrow().as_ref() {
                        win.queue_draw();
                    }
                });
            })
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Remove a pane's grid (pane closed).
#[tauri::command]
pub fn native_grid_detach(app: tauri::AppHandle, id: u64) -> Result<(), String> {
    let removed = {
        let mut map = models().lock();
        map.remove(&id).inspect(|m| {
            *m.generation.lock() += 1;
        })
    };
    if let Some(model) = removed {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.run_on_main_thread(move || {
                let (x, y, w, h) = *model.rect.lock();
                HOOKED.with(|hw| {
                    if let Some(win) = hw.borrow().as_ref() {
                        win.queue_draw_area(x, y, w, h);
                    }
                });
            });
        }
    }
    Ok(())
}

/// Update the viewport rows occupied by DOM block bars (left unpainted).
#[tauri::command]
pub fn native_grid_set_holes(app: tauri::AppHandle, id: u64, rows: Vec<usize>) -> Result<(), String> {
    if let Some(model) = models().lock().get(&id).cloned() {
        if std::env::var_os("LUME_GRID_DEBUG").is_some() {
            eprintln!("[grid-holes] id={id} rows={rows:?}");
        }
        *model.holes.lock() = rows;
    }
    if let Some(model) = models().lock().get(&id).cloned() {
        let window = app
            .get_webview_window("main")
            .ok_or("main window not found")?;
        window
            .run_on_main_thread(move || queue_model_redraw(&model, None))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Mirror web-side pane focus: only the focused pane draws its cursor.
#[tauri::command]
pub fn native_grid_set_focused(app: tauri::AppHandle, id: u64, focused: bool) -> Result<(), String> {
    if let Some(model) = models().lock().get(&id).cloned() {
        *model.focused.lock() = focused;
        let window = app
            .get_webview_window("main")
            .ok_or("main window not found")?;
        window
            .run_on_main_thread(move || queue_model_redraw(&model, None))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Mirror xterm's selection (viewport coords) so the grid paints it live —
/// no renderer swap during drags. `sel` = [startRow, startCol, endRow,
/// endColExclusive], linewise; None clears.
#[tauri::command]
pub fn native_grid_set_selection(
    app: tauri::AppHandle,
    id: u64,
    sel: Option<[i32; 4]>,
) -> Result<(), String> {
    if let Some(model) = models().lock().get(&id).cloned() {
        let changed = {
            let mut cur = model.selection.lock();
            let new = sel.map(|s| (s[0], s[1], s[2], s[3]));
            let changed = *cur != new;
            *cur = new;
            changed
        };
        if changed {
            let window = app
                .get_webview_window("main")
                .ok_or("main window not found")?;
            window
                .run_on_main_thread(move || queue_model_redraw(&model, None))
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// Update the DOM-affordance rects the grids must not paint over (window
/// coordinates). Repaints the union of old and new rects.
#[tauri::command]
pub fn native_grid_set_overlay_rects(
    app: tauri::AppHandle,
    rects: Vec<[i32; 4]>,
) -> Result<(), String> {
    let new: Vec<(i32, i32, i32, i32)> = rects
        .into_iter()
        .map(|r| (r[0], r[1], r[2], r[3]))
        .collect();
    let old = {
        let mut cur = OVERLAY_RECTS.lock();
        if *cur == new {
            return Ok(());
        }
        std::mem::replace(&mut *cur, new.clone())
    };
    let window = app
        .get_webview_window("main")
        .ok_or("main window not found")?;
    window
        .run_on_main_thread(move || {
            HOOKED.with(|hw| {
                if let Some(win) = hw.borrow().as_ref() {
                    for (x, y, w, h) in old.iter().chain(new.iter()) {
                        win.queue_draw_area(*x, *y, *w, *h);
                    }
                }
            });
        })
        .map_err(|e| e.to_string())
}
