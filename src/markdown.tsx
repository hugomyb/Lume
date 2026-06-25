import { For, Show } from "solid-js";
import { openUrl } from "@tauri-apps/plugin-opener";
import { highlight } from "./syntax";

type Inline =
  | { type: "text"; value: string }
  | { type: "code"; value: string }
  | { type: "bold"; value: string }
  | { type: "link"; text: string; href: string };

type Block =
  | { type: "paragraph"; inlines: Inline[] }
  | { type: "heading"; level: 3 | 4 | 5 | 6; inlines: Inline[] }
  | { type: "codeBlock"; value: string; lang: string }
  | { type: "list"; ordered: boolean; items: Inline[][] }
  | { type: "table"; headers: Inline[][]; rows: Inline[][][] };

const BULLET_RE = /^\s*[-*]\s+/;
const ORDERED_RE = /^\s*\d+[.)]\s+/;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;
// Row of a markdown table: starts and ends with `|`, contains at least one
// pipe-separated cell. We don't require leading whitespace.
const TABLE_ROW_RE = /^\s*\|.+\|\s*$/;
// Separator row: `| --- | :-- | ... |` (with optional colons for alignment).
const TABLE_SEP_RE = /^\s*\|\s*:?\s*-{3,}\s*:?\s*(\|\s*:?\s*-{3,}\s*:?\s*)*\|\s*$/;

function parseInline(s: string): Inline[] {
  const nodes: Inline[] = [];
  let i = 0;
  const pushText = (value: string) => {
    if (!value) return;
    const last = nodes[nodes.length - 1];
    if (last && last.type === "text") last.value += value;
    else nodes.push({ type: "text", value });
  };

  while (i < s.length) {
    if (s[i] === "`") {
      const end = s.indexOf("`", i + 1);
      if (end === -1) {
        pushText(s.slice(i));
        break;
      }
      nodes.push({ type: "code", value: s.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    if (s.startsWith("**", i)) {
      const end = s.indexOf("**", i + 2);
      if (end === -1) {
        pushText(s.slice(i));
        break;
      }
      nodes.push({ type: "bold", value: s.slice(i + 2, end) });
      i = end + 2;
      continue;
    }
    // Link: [text](url)
    if (s[i] === "[") {
      const closeText = s.indexOf("]", i + 1);
      if (closeText !== -1 && s[closeText + 1] === "(") {
        const closeUrl = s.indexOf(")", closeText + 2);
        if (closeUrl !== -1) {
          const text = s.slice(i + 1, closeText);
          const href = s.slice(closeText + 2, closeUrl).trim();
          nodes.push({ type: "link", text, href });
          i = closeUrl + 1;
          continue;
        }
      }
    }
    let next = i + 1;
    while (next < s.length) {
      const c = s[next];
      if (c === "`") break;
      if (c === "*" && s[next + 1] === "*") break;
      if (c === "[") break;
      next++;
    }
    pushText(s.slice(i, next));
    i = next;
  }
  return nodes;
}

function parseMarkdown(s: string): Block[] {
  const blocks: Block[] = [];
  const lines = s.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trimStart().startsWith("```")) {
      const lang = line.trimStart().slice(3).trim();
      const start = i + 1;
      let end = start;
      while (end < lines.length && !lines[end].trimStart().startsWith("```")) {
        end++;
      }
      blocks.push({
        type: "codeBlock",
        value: lines.slice(start, end).join("\n"),
        lang,
      });
      i = end >= lines.length ? lines.length : end + 1;
      continue;
    }

    // Table: header row, then separator, then any number of body rows.
    if (
      TABLE_ROW_RE.test(line) &&
      i + 1 < lines.length &&
      TABLE_SEP_RE.test(lines[i + 1])
    ) {
      const splitRow = (row: string): string[] => {
        const trimmed = row.trim().replace(/^\|/, "").replace(/\|$/, "");
        return trimmed.split("|").map((s) => s.trim());
      };
      const headerCells = splitRow(line).map((c) => parseInline(c));
      i += 2; // skip header + separator
      const bodyRows: Inline[][][] = [];
      while (i < lines.length && TABLE_ROW_RE.test(lines[i])) {
        bodyRows.push(splitRow(lines[i]).map((c) => parseInline(c)));
        i++;
      }
      blocks.push({ type: "table", headers: headerCells, rows: bodyRows });
      continue;
    }

    // Heading
    const hm = HEADING_RE.exec(line);
    if (hm) {
      const hashes = hm[1].length;
      // Cap at h3..h6 — h1/h2 are too big inside the sidebar.
      const level = Math.min(6, Math.max(3, hashes + 2)) as 3 | 4 | 5 | 6;
      blocks.push({
        type: "heading",
        level,
        inlines: parseInline(hm[2]),
      });
      i++;
      continue;
    }

    // List
    const isBullet = BULLET_RE.test(line);
    const isOrdered = !isBullet && ORDERED_RE.test(line);
    if (isBullet || isOrdered) {
      const items: Inline[][] = [];
      const re = isBullet ? BULLET_RE : ORDERED_RE;
      while (
        i < lines.length &&
        (isBullet ? BULLET_RE.test(lines[i]) : ORDERED_RE.test(lines[i]))
      ) {
        const itemText = lines[i].replace(re, "");
        items.push(parseInline(itemText));
        i++;
      }
      blocks.push({ type: "list", ordered: isOrdered, items });
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trimStart().startsWith("```") &&
      !BULLET_RE.test(lines[i]) &&
      !ORDERED_RE.test(lines[i]) &&
      !HEADING_RE.test(lines[i]) &&
      !(
        TABLE_ROW_RE.test(lines[i]) &&
        i + 1 < lines.length &&
        TABLE_SEP_RE.test(lines[i + 1])
      )
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({
      type: "paragraph",
      inlines: parseInline(paraLines.join("\n")),
    });
  }

  return blocks;
}

function onLinkClick(href: string, e: MouseEvent) {
  e.preventDefault();
  openUrl(href).catch((err) => console.error("openUrl", err));
}

function Inlines(props: { nodes: Inline[] }) {
  return (
    <For each={props.nodes}>
      {(node) => {
        switch (node.type) {
          case "text":
            return <>{node.value}</>;
          case "code":
            return <code>{node.value}</code>;
          case "bold":
            return <strong>{node.value}</strong>;
          case "link":
            return (
              <a
                class="md-link"
                href={node.href}
                title={node.href}
                onClick={(e) => onLinkClick(node.href, e)}
              >
                {node.text}
              </a>
            );
        }
      }}
    </For>
  );
}

function HeadingNode(props: { level: 3 | 4 | 5 | 6; inlines: Inline[] }) {
  // Solid renders dynamic tags via Dynamic, but for our 4 cases a switch is simpler.
  switch (props.level) {
    case 3:
      return (
        <h3 class="md-h md-h3">
          <Inlines nodes={props.inlines} />
        </h3>
      );
    case 4:
      return (
        <h4 class="md-h md-h4">
          <Inlines nodes={props.inlines} />
        </h4>
      );
    case 5:
      return (
        <h5 class="md-h md-h5">
          <Inlines nodes={props.inlines} />
        </h5>
      );
    case 6:
      return (
        <h6 class="md-h md-h6">
          <Inlines nodes={props.inlines} />
        </h6>
      );
  }
}

function CodeBlock(props: { value: string; lang: string }) {
  const tokens = () => highlight(props.value, props.lang);
  return (
    <pre class="md-code-block" data-lang={props.lang || undefined}>
      <code>
        <For each={tokens()}>
          {(t) =>
            t.type === "text" ? (
              <>{t.value}</>
            ) : (
              <span class={`tok tok-${t.type}`}>{t.value}</span>
            )
          }
        </For>
      </code>
    </pre>
  );
}

type Props = {
  text: string;
  streaming?: boolean;
};

export default function MarkdownRender(props: Props) {
  return (
    <>
      <For each={parseMarkdown(props.text)}>
        {(block) => {
          switch (block.type) {
            case "paragraph":
              return (
                <p class="md-p">
                  <Inlines nodes={block.inlines} />
                </p>
              );
            case "heading":
              return <HeadingNode level={block.level} inlines={block.inlines} />;
            case "codeBlock":
              return <CodeBlock value={block.value} lang={block.lang} />;
            case "table":
              return (
                <div class="md-table-wrap">
                  <table class="md-table">
                    <thead>
                      <tr>
                        <For each={block.headers}>
                          {(cell) => (
                            <th>
                              <Inlines nodes={cell} />
                            </th>
                          )}
                        </For>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={block.rows}>
                        {(row) => (
                          <tr>
                            <For each={row}>
                              {(cell) => (
                                <td>
                                  <Inlines nodes={cell} />
                                </td>
                              )}
                            </For>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              );
            case "list":
              return block.ordered ? (
                <ol class="md-list">
                  <For each={block.items}>
                    {(item) => (
                      <li>
                        <Inlines nodes={item} />
                      </li>
                    )}
                  </For>
                </ol>
              ) : (
                <ul class="md-list">
                  <For each={block.items}>
                    {(item) => (
                      <li>
                        <Inlines nodes={item} />
                      </li>
                    )}
                  </For>
                </ul>
              );
          }
        }}
      </For>
      <Show when={props.streaming}>
        <span class="ai-cursor">▌</span>
      </Show>
    </>
  );
}
