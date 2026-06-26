import { For } from "solid-js";
import type { Suggestion } from "./autocomplete";
import { t } from "./i18n";

export type AcPosition = {
  x: number;
  y: number;
  above: boolean;
  maxWidth: number;
};

type Props = {
  items: () => Suggestion[];
  index: () => number;
  pos: () => AcPosition;
  onPick: (i: number) => void;
  onHover: (i: number) => void;
};

const ICONS: Record<Suggestion["kind"], string> = {
  history: "⟳",
  path: "›",
  command: "»",
  alias: "≈",
};

/** Inline-completion dropdown. Positioned `fixed` at screen coords computed by
 *  the Terminal from the xterm cursor, so it escapes any ancestor overflow and
 *  floats above the WebGL canvas. */
export default function Autocomplete(props: Props) {
  return (
    <div
      class="lume-autocomplete"
      classList={{ above: props.pos().above }}
      style={{
        left: `${props.pos().x}px`,
        top: `${props.pos().y}px`,
        "max-width": `${props.pos().maxWidth}px`,
      }}
      // Keep the terminal's hidden textarea focused on click.
      onMouseDown={(e) => e.preventDefault()}
    >
      <div class="lume-ac-list">
        <For each={props.items()}>
          {(it, i) => (
            <div
              class="lume-ac-item"
              classList={{ selected: i() === props.index() }}
              onMouseEnter={() => props.onHover(i())}
              onClick={() => props.onPick(i())}
            >
              <span class="lume-ac-icon" data-kind={it.kind}>
                {ICONS[it.kind]}
              </span>
              <span class="lume-ac-label">{it.display}</span>
              <span class="lume-ac-hint">{it.hint}</span>
            </div>
          )}
        </For>
      </div>
      <div class="lume-ac-footer">
        <span innerHTML={t("ac.complete")} />
        <span innerHTML={t("ac.navigate")} />
        <span innerHTML={t("ac.close")} />
      </div>
    </div>
  );
}
