# Chantier « renderer natif » — plan d'architecture

## Pourquoi

Mesuré le 16/07/2026 (X11, outil XDamage pty→pixel) : le pipeline applicatif de Lume
produit ses pixels en ~2 ms, mais ils traversent ensuite deux files d'attente
structurelles de WebKitGTK (tick du compositeur du WebProcess à 60 Hz, puis frame
clock GTK de l'UIProcess) : **~14 ms** au total, contre **~1,1 ms** pour VTE
(gnome-terminal) qui peint directement dans son widget. Aucun réglage ne contourne
ces files (env WebKit, `desynchronized`, vsync, SHM… tous testés sans effet).
Pour égaler un terminal natif, la grille doit être peinte par un widget natif,
hors du WebView.

## Architecture cible

```
GtkWindow (Tauri)
└── GtkBox (default_vbox Tauri)
    └── GtkOverlay
        ├── WebKitWebView        ← chrome Lume : tabs, splits, blocks, palette IA,
        │                          autocomplete, settings (inchangés)
        └── GtkFixed (overlay)
            ├── GridArea pane 1  ← GtkDrawingArea, peint par cairo/pango
            ├── GridArea pane 2     depuis un modèle terminal Rust
            └── …
```

- **Modèle terminal en Rust** : crate `alacritty_terminal` (parser VT + grille +
  scrollback + damage tracking, éprouvé). Un `Term` par pane, alimenté par le
  broadcast `output_tx` déjà présent dans `PtySession` (le même fan-out que le
  remote control — snapshot replay + flux live, frontière propre).
- **Peinture** : `GtkDrawingArea` + cairo/pango (approche VTE). Redraw des lignes
  damaged uniquement. Latence attendue pty→pixel : ~1-3 ms.
- **Le web reste maître de l'input et du layout** : chaque pane web publie son
  rect (via invoke) ; Rust positionne les GridAreas dans le GtkFixed. Clavier :
  inchangé (xterm/DOM → `pty_write`). Souris sur la grille : events forwardés au
  Rust (hit-test cellule) pour sélection/liens.

## Phases

- **Phase 0 — PoC : ✅ VALIDÉE (16/07/2026)** : une GridArea branchée sur un pty,
  rendu cairo naïf, gate `localStorage lume.nativeGrid=1` (module
  `native_grid.rs`). **Mesuré : 1,1-3,9 ms pty→pixel** (vs ~14 ms via WebKit,
  vs 1,1 ms pour VTE) — objectif atteint. Compositing GtkOverlay au-dessus du
  GL de WebKit : OK. Pass-through input : OK.
  **Piège découvert** : le handler de resize des fenêtres sans décorations de
  wry (`undecorated_resizing.rs`) fait `webview.parent().parent()` et
  unwrap-downcast en `GtkWindow` à chaque clic gauche → l'overlay doit
  REMPLACER la vbox par défaut de tao (hiérarchie
  `GtkWindow > GtkOverlay > (WebView, GtkFixed)`), pas s'insérer dedans.
  À signaler upstream à wry.
- **Phase 1 — intégration visuelle** : sync des rects pane↔GridArea (resize,
  splits, tabs), thème/fonts depuis `config.toml` (pango), curseur (formes +
  blink), scrollback (offset de viewport piloté par la molette côté web),
  HiDPI (scale factor).
- **Phase 2 — input & sélection** : la zone grille devient input-transparente
  côté GTK (events souris capturés par un calque web transparent au-dessus) ;
  sélection = hit-test Rust + highlight natif + PRIMARY/clipboard ; liens
  (détection URL dans la grille, Ctrl+clic).
- **Phase 3 — parité features** : blocks OSC 133 (déjà parsés côté Rust dans
  `osc.rs`), ancre autocomplete (position curseur depuis le `Term`), recherche
  scrollback, « process exited », notifications de commandes longues.
- **Phase 4 — bascule** : xterm.js retiré du chemin grille (gardé en fallback
  configurable le temps de stabiliser ; utile aussi pour le remote web).

## Points ouverts

- Wayland : GtkOverlay fonctionne pareil, mais à re-mesurer.
- macOS/Windows : ce chantier est Linux-first (WKWebView/WebView2 ont d'autres
  caractéristiques de latence — WebView2/Chromium implémente notamment
  `desynchronized`). L'abstraction « GridArea » devra rester par-plateforme.
- IME/compose : à traiter en phase 2 (le clavier passe par le web, donc l'IME
  web continue de fonctionner — à vérifier).

## État au 16/07/2026 soir (v1 opt-in)

Implémenté et validé : multi-panes, pango+thème+police config, damage par
lignes, curseur+blink, bascule xterm auto (sélection/scroll/recherche/
autocomplete/modales), suivi de position, flood 200k OK, latence 1,7-3,9 ms.

Piste « trous » pour les block bars (lignes non peintes → le DOM montre à
travers) : mécanique en place (`native_grid_set_holes` + syncHoles JS) mais a
introduit une régression « fond peint, texte absent » sur tous les panes —
plus les gardes 0×0 (panes cachés → cairo OOM, corrigé par attach différé +
clamps). À reprendre : vérifier le contenu de `holes` réellement envoyé
(suspect n°1 : syncHoles envoie trop de lignes ou des valeurs erronées),
comparer avec le commit ng8 fonctionnel. Le natif reste opt-in tant que ce
n'est pas réglé ; le défaut = pipeline xterm optimisé (~14 ms).
