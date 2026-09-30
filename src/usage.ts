import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { createSignal } from "solid-js";
import { aiPlanUsage, type PlanWindow } from "./ai";

/** What a provider reported about one request. Every field is optional —
 *  providers expose different slices, and the backend sends partial updates as
 *  they arrive rather than one complete picture at the end (see `AiUsageEvent`
 *  in src-tauri/src/ai.rs). */
export type AiUsageEvent = {
  requestId: number;
  costUsd: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  model: string | null;
  planWindow: string | null;
  planStatus: string | null;
  planResetsAt: number | null;
  remainingRequests: string | null;
  remainingTokens: string | null;
};

export type UsageState = {
  /** Summed over the requests made since Lume started. Not persisted: a
   *  lifetime total would need storage and a retention policy, and the
   *  question the pill answers is "what is this session costing me". */
  sessionCostUsd: number;
  requests: number;
  lastModel: string | null;
  lastInputTokens: number | null;
  lastOutputTokens: number | null;
  lastCacheReadTokens: number | null;
  planWindow: string | null;
  planStatus: string | null;
  planResetsAt: number | null;
  remainingRequests: string | null;
  remainingTokens: string | null;
};

const EMPTY: UsageState = {
  sessionCostUsd: 0,
  requests: 0,
  lastModel: null,
  lastInputTokens: null,
  lastOutputTokens: null,
  lastCacheReadTokens: null,
  planWindow: null,
  planStatus: null,
  planResetsAt: null,
  remainingRequests: null,
  remainingTokens: null,
};

const [usage, setUsage] = createSignal<UsageState>(EMPTY);

export { usage };

/** Whether anything has been reported at all — the pill stays hidden until a
 *  provider actually gives us a number, rather than showing an empty gauge. */
export function hasUsage(): boolean {
  const u = usage();
  return (
    u.requests > 0 ||
    u.planStatus !== null ||
    u.remainingRequests !== null ||
    u.remainingTokens !== null
  );
}

/** Start listening for backend usage reports. Returns the unlisten fn. */
export async function listenUsage(): Promise<UnlistenFn> {
  return listen<AiUsageEvent>("ai:usage", (e) => {
    const p = e.payload;
    setUsage((u) => ({
      sessionCostUsd: u.sessionCostUsd + (p.costUsd ?? 0),
      // A request counts once it reports a cost — the plan-window event fires
      // on the same request and would otherwise double-count it.
      requests: u.requests + (p.costUsd !== null ? 1 : 0),
      lastModel: p.model ?? u.lastModel,
      lastInputTokens: p.inputTokens ?? u.lastInputTokens,
      lastOutputTokens: p.outputTokens ?? u.lastOutputTokens,
      lastCacheReadTokens: p.cacheReadTokens ?? u.lastCacheReadTokens,
      planWindow: p.planWindow ?? u.planWindow,
      planStatus: p.planStatus ?? u.planStatus,
      planResetsAt: p.planResetsAt ?? u.planResetsAt,
      remainingRequests: p.remainingRequests ?? u.remainingRequests,
      remainingTokens: p.remainingTokens ?? u.remainingTokens,
    }));
    // A priced request is the moment the plan percentages actually move —
    // pull them again instead of leaving the ring stale until the next poll.
    // Throttled, so a burst of requests spawns one lookup, not one each.
    if (p.costUsd !== null) void refreshPlanUsage(15_000);
  });
}

/** Cost with enough precision to be useful at both ends of the range: a single
 *  cheap call is fractions of a cent, a long session is dollars. */
export function formatCost(usd: number): string {
  if (usd <= 0) return "$0";
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toFixed(2)}`;
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/** Unix seconds → local clock time. */
export function formatResetTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// --- Subscription limit windows -------------------------------------------
// Separate from the per-request events above: these come from their own CLI
// call, so they're polled rather than pushed. The call is free (no model
// request) but spawns a ~2s process, hence the slow cadence.

const [planWindows, setPlanWindows] = createSignal<PlanWindow[]>([]);
export { planWindows };

let planFetching = false;
let lastPlanFetch = 0;

/** Refresh unless a fetch is in flight or one landed less than `maxAgeMs` ago. */
export async function refreshPlanUsage(maxAgeMs = 300_000): Promise<void> {
  if (planFetching) return;
  if (Date.now() - lastPlanFetch < maxAgeMs) return;
  planFetching = true;
  try {
    setPlanWindows(await aiPlanUsage());
    lastPlanFetch = Date.now();
  } catch {
    setPlanWindows([]);
  } finally {
    planFetching = false;
  }
}

/** Drop what the previous provider reported. Called when the active provider
 *  changes: a subscription ring left over from the Claude CLI would otherwise
 *  keep showing next to an OpenAI key it has nothing to do with. */
export function resetPlanUsage(): void {
  setPlanWindows([]);
  lastPlanFetch = 0;
}

/** How full the tightest window is — the one that will cut you off first. */
export function planPeakPercent(): number | null {
  const w = planWindows();
  if (w.length === 0) return null;
  return Math.max(...w.map((x) => x.percentUsed));
}

/** Poll the limit windows for the lifetime of the app. Returns a stop fn. */
export function startPlanPolling(): () => void {
  void refreshPlanUsage(0);
  const id = setInterval(() => void refreshPlanUsage(), 300_000);
  return () => clearInterval(id);
}

/** Whether the detail card is open. Module-level because the pill lives in
 *  `.tab-actions` while the card is rendered as a sibling of it — the same
 *  placement the layouts popup uses, which is the one that renders correctly
 *  over the terminal on Linux. */
const [usageCardOpen, setUsageCardOpen] = createSignal(false);
export { usageCardOpen, setUsageCardOpen };
