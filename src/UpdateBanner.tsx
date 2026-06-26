import { createSignal, onMount, Show } from "solid-js";
import { checkForUpdate, installUpdate, type Update } from "./updater";

/** A slim banner that appears when a new Lume version is available. Auto-checks
 *  shortly after launch; lets the user install + relaunch in one click. */
export default function UpdateBanner() {
  const [update, setUpdate] = createSignal<Update | null>(null);
  const [installing, setInstalling] = createSignal(false);
  const [progress, setProgress] = createSignal(0);
  const [dismissed, setDismissed] = createSignal(false);
  const [error, setError] = createSignal(false);

  onMount(() => {
    // Delay a few seconds so the check doesn't compete with startup.
    setTimeout(async () => {
      const u = await checkForUpdate();
      if (u) setUpdate(u);
    }, 4000);
  });

  const install = async () => {
    const u = update();
    if (!u || installing()) return;
    setInstalling(true);
    setError(false);
    try {
      await installUpdate(u, setProgress); // relaunches on success
    } catch (e) {
      console.error("[update] install failed", e);
      setError(true);
      setInstalling(false);
    }
  };

  return (
    <Show when={update() && !dismissed()}>
      <div class="update-banner">
        <span class="update-banner-text">
          <strong>Lume {update()!.version}</strong> est disponible
          <Show when={error()}>
            {" "}
            — <span class="update-banner-err">échec, réessayer</span>
          </Show>
        </span>
        <Show
          when={!installing()}
          fallback={
            <span class="update-banner-progress">
              Téléchargement… {progress()}%
            </span>
          }
        >
          <div class="update-banner-actions">
            <button class="update-banner-btn primary" onClick={install}>
              Installer et redémarrer
            </button>
            <button
              class="update-banner-btn"
              onClick={() => setDismissed(true)}
            >
              Plus tard
            </button>
          </div>
        </Show>
      </div>
    </Show>
  );
}
