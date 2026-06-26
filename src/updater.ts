import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type { Update };

/** Check the release endpoint for a newer version. Returns null if up to date
 *  or if the check fails (e.g. offline, or running in dev without a release). */
export async function checkForUpdate(): Promise<Update | null> {
  try {
    return await check();
  } catch (e) {
    console.error("[update] check failed", e);
    return null;
  }
}

/** Download + install an update (verifying its signature), then relaunch. */
export async function installUpdate(
  update: Update,
  onProgress?: (percent: number) => void
): Promise<void> {
  let downloaded = 0;
  let total = 0;
  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case "Started":
        total = event.data.contentLength ?? 0;
        break;
      case "Progress":
        downloaded += event.data.chunkLength;
        if (total > 0) onProgress?.(Math.round((downloaded / total) * 100));
        break;
      case "Finished":
        onProgress?.(100);
        break;
    }
  });
  await relaunch();
}
