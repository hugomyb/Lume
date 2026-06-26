import { createEffect, createSignal, Show } from "solid-js";
import QRCode from "qrcode";
import { copyText } from "./clipboard";
import type { RemoteInfo } from "./remote";
import { t } from "./i18n";

/** Slide-over panel (opened from the pane context menu) that shows the share
 *  URL + QR for remote control, a live connected-clients badge, and a stop
 *  button — no Settings trip needed. */
export default function RemoteDialog(props: {
  open: () => boolean;
  info: () => RemoteInfo | null;
  installing: () => boolean;
  onEnableTunnel: () => void;
  onStop: () => void;
  onClose: () => void;
}) {
  const [qr, setQr] = createSignal("");

  // The URL to share: the public (tunnel) one if requested, else the LAN one.
  const shareUrl = () => {
    const i = props.info();
    if (!i || !i.running) return "";
    return i.tunnelRequested ? i.publicUrl ?? "" : i.url;
  };
  const pending = () => {
    const i = props.info();
    return !!i?.tunnelRequested && !i?.publicUrl;
  };
  const clients = () => props.info()?.clients ?? 0;

  createEffect(() => {
    const url = shareUrl();
    if (!url) {
      setQr("");
      return;
    }
    QRCode.toDataURL(url, { margin: 1, width: 220 })
      .then(setQr)
      .catch(() => setQr(""));
  });

  return (
    <Show when={props.open()}>
      <div class="remote-overlay" onClick={() => props.onClose()}>
        <div class="remote-slideover" onClick={(e) => e.stopPropagation()}>
          <div class="remote-head">
            <span class="remote-title">{t("remote.title")}</span>
            <button class="remote-x" onClick={() => props.onClose()}>
              ×
            </button>
          </div>

          <div
            class="remote-badge"
            classList={{ connected: clients() > 0 }}
          >
            <span class="remote-badge-dot" />
            {clients() > 0
              ? t("remote.connected", { n: clients() })
              : t("remote.active")}
          </div>

          <Show
            when={shareUrl()}
            fallback={
              <p class="remote-status">
                {pending()
                  ? t("remote.creatingTunnel")
                  : t("remote.starting")}
              </p>
            }
          >
            <Show when={qr()}>
              <img class="remote-qr" src={qr()} alt="QR code" />
            </Show>
            <p class="remote-hint">
              {props.info()?.tunnelRequested
                ? t("remote.scanPublic")
                : t("remote.scanLan")}
            </p>
            <div class="remote-url-row">
              <code class="remote-url">{shareUrl()}</code>
              <button
                class="settings-import-btn"
                onClick={() => copyText(shareUrl())}
              >
                {t("remote.copy")}
              </button>
            </div>
          </Show>

          <Show
            when={
              props.info()?.tunnelRequested === false &&
              props.info()?.tunnelAvailable === false
            }
          >
            <div class="remote-install">
              <p class="remote-hint" innerHTML={t("remote.installHint")} />
              <button
                class="remote-install-btn"
                disabled={props.installing()}
                onClick={() => props.onEnableTunnel()}
              >
                {props.installing()
                  ? t("remote.installing")
                  : t("remote.installBtn")}
              </button>
            </div>
          </Show>

          <div class="remote-spacer" />

          <p class="remote-warn">{t("remote.warn")}</p>
          <button class="remote-stop" onClick={() => props.onStop()}>
            {t("remote.stop")}
          </button>
        </div>
      </div>
    </Show>
  );
}
