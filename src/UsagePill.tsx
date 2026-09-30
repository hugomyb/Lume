import { For, onCleanup, Show } from "solid-js";
import { t } from "./i18n";
import {
  formatCost,
  formatTokens,
  hasUsage,
  planPeakPercent,
  planWindows,
  refreshPlanUsage,
  setUsageCardOpen,
  usage,
  usageCardOpen,
} from "./usage";

/** Consumption indicator in the tab bar. On a subscription the meaningful
 *  number is how much of the plan is spent, not a dollar amount — nothing is
 *  billed per call — so the pill is a ring filled to the tightest window.
 *  API providers, which do bill per call, keep a figure instead. */
type Props = {
  /** Active provider id, from `ai_status`. */
  provider: () => string;
};

/** Providers that report consumption at all. `codex` and `custom` hand us
 *  nothing, so the pill stays out of the way there rather than showing a
 *  gauge that can never fill. */
const REPORTING = ["claude", "openai", "deepseek", "api"];

/** Same wording as the Settings dropdown, so the card names the provider the
 *  way the user picked it. Two entries are translated there and stay so. */
function providerLabel(id: string): string {
  switch (id) {
    case "claude":
      return "Claude (CLI)";
    case "codex":
      return "Codex (CLI)";
    case "openai":
      return "OpenAI (API)";
    case "deepseek":
      return "DeepSeek (API)";
    case "api":
      return t("ai.customApi");
    case "custom":
      return t("ai.custom");
    default:
      return id;
  }
}

/** Ring geometry: r=8 in a 20×20 box, so the circumference the dash array
 *  works against is 2πr. */
const R = 8;
const CIRCUMFERENCE = 2 * Math.PI * R;

function Ring(props: { percent: number }) {
  const filled = () => (Math.min(100, Math.max(0, props.percent)) / 100) * CIRCUMFERENCE;
  return (
    <svg class="usage-ring" viewBox="0 0 20 20" width="13" height="13" aria-hidden="true">
      <circle class="usage-ring-track" cx="10" cy="10" r={R} />
      <circle
        class="usage-ring-fill"
        classList={{ high: props.percent >= 80 }}
        cx="10"
        cy="10"
        r={R}
        stroke-dasharray={`${filled()} ${CIRCUMFERENCE}`}
      />
    </svg>
  );
}

/** Closing is deferred: moving from the pill to the card crosses a gap, and
 *  the two are no longer nested. Shared so both ends can cancel it. */
let closeTimer: ReturnType<typeof setTimeout> | undefined;
function cancelClose() {
  if (closeTimer) clearTimeout(closeTimer);
  closeTimer = undefined;
}
function scheduleClose() {
  cancelClose();
  closeTimer = setTimeout(() => {
    setUsageCardOpen(false);
    // Let the native grid know the hole is gone so it repaints the terminal.
    window.dispatchEvent(new Event("lume-overlay-sync"));
  }, 150);
}

export default function UsagePill(props: Props) {
  const u = () => usage();
  const visible = () => REPORTING.includes(props.provider()) || hasUsage();
  const peak = () => planPeakPercent();

  const throttled = () => {
    const s = u().planStatus;
    return (s !== null && s !== "allowed") || (peak() ?? 0) >= 80;
  };

  const open = () => {
    cancelClose();
    setUsageCardOpen(true);
    void refreshPlanUsage(60_000);
    window.dispatchEvent(new Event("lume-overlay-sync"));
  };

  /** What the pill says when there is no plan ring to draw: per-call billing
   *  (an API provider's cost) or the quota its headers reported. */
  const fallbackLabel = () => {
    if (u().requests > 0) return formatCost(u().sessionCostUsd);
    const req = u().remainingRequests;
    if (req !== null) return t("usage.pillRequests", { n: req });
    return t("usage.pillQuota");
  };

  onCleanup(cancelClose);

  return (
    <Show when={visible()}>
      <div class="usage-pill-wrap" onMouseEnter={open} onMouseLeave={scheduleClose}>
        <button
          class="usage-pill"
          classList={{ throttled: throttled() }}
          aria-label={t("usage.title")}
        >
          <Show when={peak() !== null} fallback={fallbackLabel()}>
            <Ring percent={peak()!} />
            <span>{t("usage.percentUsed", { n: peak()! })}</span>
          </Show>
        </button>
      </div>
    </Show>
  );
}

/** The detail panel. Rendered by Tabs next to the layouts popup — NOT inside
 *  `.tab-actions` — so it resolves against the same positioned ancestor as
 *  that popup, the one placement proven to paint correctly over the panes. */
export function UsageCard(props: Props) {
  const u = () => usage();

  const hasDetails = () =>
    u().requests > 0 ||
    u().lastInputTokens !== null ||
    u().lastOutputTokens !== null ||
    (u().lastCacheReadTokens ?? 0) > 0 ||
    u().remainingRequests !== null ||
    u().remainingTokens !== null;

  return (
    <Show when={usageCardOpen()}>
      <div class="usage-card" onMouseEnter={cancelClose} onMouseLeave={scheduleClose}>
        <div class="usage-card-title">{t("usage.title")}</div>

        <div class="usage-row">
          <span class="usage-key">{t("usage.provider")}</span>
          <span class="usage-val">{providerLabel(props.provider())}</span>
        </div>
        <Show when={u().lastModel}>
          <div class="usage-row">
            <span class="usage-key">{t("usage.model")}</span>
            <span class="usage-val">{u().lastModel}</span>
          </div>
        </Show>

        <Show when={planWindows().length > 0}>
          <div class="usage-sep" />
          <For each={planWindows()}>
            {(w) => (
              <div class="usage-gauge">
                <div class="usage-gauge-head">
                  <span class="usage-key">{w.label}</span>
                  <span class="usage-val">
                    {t("usage.percentUsed", { n: w.percentUsed })}
                  </span>
                </div>
                <div class="usage-bar">
                  <div
                    class="usage-bar-fill"
                    classList={{ high: w.percentUsed >= 80 }}
                    style={{ width: `${Math.min(100, w.percentUsed)}%` }}
                  />
                </div>
                <Show when={w.resets}>
                  <div class="usage-gauge-reset">
                    {t("usage.resetsAt", { when: w.resets })}
                  </div>
                </Show>
              </div>
            )}
          </For>
        </Show>

        <Show when={hasDetails()}>
          <div class="usage-sep" />
          <Show when={u().requests > 0}>
            <div class="usage-row">
              <span class="usage-key">{t("usage.sessionCost")}</span>
              <span class="usage-val">{formatCost(u().sessionCostUsd)}</span>
            </div>
            <div class="usage-row">
              <span class="usage-key">{t("usage.requests")}</span>
              <span class="usage-val">{u().requests}</span>
            </div>
          </Show>
          <Show when={u().lastInputTokens !== null || u().lastOutputTokens !== null}>
            <div class="usage-row">
              <span class="usage-key">{t("usage.lastTokens")}</span>
              <span class="usage-val">
                {formatTokens(u().lastInputTokens ?? 0)} →{" "}
                {formatTokens(u().lastOutputTokens ?? 0)}
              </span>
            </div>
          </Show>
          <Show when={(u().lastCacheReadTokens ?? 0) > 0}>
            <div class="usage-row">
              <span class="usage-key">{t("usage.cacheRead")}</span>
              <span class="usage-val">{formatTokens(u().lastCacheReadTokens!)}</span>
            </div>
          </Show>
          <Show when={u().remainingRequests}>
            <div class="usage-row">
              <span class="usage-key">{t("usage.remainingRequests")}</span>
              <span class="usage-val">{u().remainingRequests}</span>
            </div>
          </Show>
          <Show when={u().remainingTokens}>
            <div class="usage-row">
              <span class="usage-key">{t("usage.remainingTokens")}</span>
              <span class="usage-val">{u().remainingTokens}</span>
            </div>
          </Show>
          <Show when={u().requests > 0}>
            <div class="usage-note">{t("usage.sessionNote")}</div>
          </Show>
        </Show>
      </div>
    </Show>
  );
}
