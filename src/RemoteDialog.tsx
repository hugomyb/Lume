import { createEffect, createSignal, For, Show } from "solid-js";
import QRCode from "qrcode";
import { copyText } from "./clipboard";
import { IconWarning, IconX } from "./icons";
import type { RemoteInfo } from "./remote";
import { relativeTime } from "./history";
import { t } from "./i18n";

/** Slide-over panel (opened from the pane context menu or the palette): the
 *  one-time pairing QR code, the paired devices (with revoke), the share
 *  address for already-paired devices, and a stop button. */
export default function RemoteDialog(props: {
  open: () => boolean;
  info: () => RemoteInfo | null;
  installing: () => boolean;
  onEnableTunnel: () => void;
  onNewPairing: () => void;
  onRevoke: (id: string) => void;
  onStop: () => void;
  onClose: () => void;
}) {
  const [qr, setQr] = createSignal("");
  const [copied, setCopied] = createSignal<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = createSignal<string | null>(null);

  const usesTunnel = () => !!props.info()?.tunnelRequested;
  // The pairing link: the public (tunnel) one if requested, else the LAN one.
  const pairUrl = () => {
    const i = props.info();
    if (!i || !i.running) return "";
    return (usesTunnel() ? i.publicPairUrl : i.pairUrl) ?? "";
  };
  /** Address for devices that are already paired (no secret in it). */
  const shareUrl = () => {
    const i = props.info();
    if (!i || !i.running) return "";
    return (usesTunnel() ? i.publicUrl : i.url) ?? "";
  };
  const pending = () => usesTunnel() && !props.info()?.publicUrl;
  const pairingOpen = () => props.info()?.pairingExpiresIn != null;
  const clients = () => props.info()?.clients ?? 0;

  createEffect(() => {
    const url = pairUrl();
    if (!url) {
      setQr("");
      return;
    }
    QRCode.toDataURL(url, { margin: 1, width: 220 })
      .then(setQr)
      .catch(() => setQr(""));
  });

  const copy = (what: string, text: string) => {
    void copyText(text);
    setCopied(what);
    setTimeout(() => setCopied((c) => (c === what ? null : c)), 1500);
  };

  return (
    <Show when={props.open()}>
      <div class="remote-overlay" onClick={() => props.onClose()}>
        <div class="remote-slideover" onClick={(e) => e.stopPropagation()}>
          <div class="remote-head">
            <span class="remote-title">{t("remote.title")}</span>
            <button class="remote-x" onClick={() => props.onClose()}>
              <IconX size={14} />
            </button>
          </div>

          <div class="remote-badge" classList={{ connected: clients() > 0 }}>
            <span class="remote-badge-dot" />
            {clients() > 0
              ? t("remote.connected", { n: clients() })
              : t("remote.active")}
          </div>

          <Show
            when={!pending() && shareUrl()}
            fallback={
              <p class="remote-status">
                {pending() ? t("remote.creatingTunnel") : t("remote.starting")}
              </p>
            }
          >
            <div class="remote-section-title">{t("remote.pairTitle")}</div>
            <Show
              when={pairingOpen() && pairUrl()}
              fallback={
                <div class="remote-pair-closed">
                  <p class="remote-hint">{t("remote.pairClosed")}</p>
                  <button class="settings-import-btn" onClick={() => props.onNewPairing()}>
                    {t("remote.newPairing")}
                  </button>
                </div>
              }
            >
              <Show when={qr()}>
                <img class="remote-qr" src={qr()} alt="QR code" />
              </Show>
              <p class="remote-hint">
                {usesTunnel() ? t("remote.scanPublic") : t("remote.scanLan")}{" "}
                {t("remote.pairExpires", {
                  n: Math.max(1, Math.ceil((props.info()?.pairingExpiresIn ?? 0) / 60)),
                })}
              </p>
              <div class="remote-url-row">
                <code class="remote-url">{pairUrl()}</code>
                <button class="settings-import-btn" onClick={() => copy("pair", pairUrl())}>
                  {copied() === "pair" ? t("remote.copied") : t("remote.copy")}
                </button>
              </div>
              <p class="remote-hint small">{t("remote.pairLumeHint")}</p>
            </Show>

            <div class="remote-section-title">{t("remote.devicesTitle")}</div>
            <Show
              when={(props.info()?.devices.length ?? 0) > 0}
              fallback={<p class="remote-hint small">{t("remote.noDevices")}</p>}
            >
              <div class="remote-devices">
                <For each={props.info()?.devices ?? []}>
                  {(d) => (
                    <div class="remote-device">
                      <span
                        class="remote-device-dot"
                        classList={{ on: d.connections > 0 }}
                      />
                      <div class="remote-device-main">
                        <span class="remote-device-name">{d.name}</span>
                        <span class="remote-device-sub">
                          {d.connections > 0
                            ? t("remote.deviceConnected")
                            : d.lastSeen
                            ? t("remote.deviceSeen", { when: relativeTime(d.lastSeen, t) })
                            : t("remote.deviceNever")}
                        </span>
                      </div>
                      <button
                        class="remote-revoke"
                        classList={{ confirm: confirmRevoke() === d.id }}
                        onClick={() => {
                          if (confirmRevoke() === d.id) {
                            setConfirmRevoke(null);
                            props.onRevoke(d.id);
                          } else {
                            setConfirmRevoke(d.id);
                          }
                        }}
                        onMouseLeave={() => confirmRevoke() === d.id && setConfirmRevoke(null)}
                      >
                        {confirmRevoke() === d.id ? t("remote.revokeConfirm") : t("remote.revoke")}
                      </button>
                    </div>
                  )}
                </For>
              </div>
              <div class="remote-url-row">
                <code class="remote-url">{shareUrl()}</code>
                <button class="settings-import-btn" onClick={() => copy("share", shareUrl())}>
                  {copied() === "share" ? t("remote.copied") : t("remote.copy")}
                </button>
              </div>
              <p class="remote-hint small">{t("remote.pairedHint")}</p>
            </Show>

            <p class="remote-e2e">{t("remote.e2e")}</p>
          </Show>

          <Show
            when={
              props.info()?.running &&
              props.info()?.tunnelRequested === false
            }
          >
            <div class="remote-install">
              <p
                class="remote-hint"
                innerHTML={
                  props.info()?.tunnelAvailable
                    ? t("remote.tunnelOffHint")
                    : t("remote.installHint")
                }
              />
              <button
                class="remote-install-btn"
                disabled={props.installing()}
                onClick={() => props.onEnableTunnel()}
              >
                {props.installing()
                  ? t("remote.installing")
                  : props.info()?.tunnelAvailable
                  ? t("remote.enableTunnel")
                  : t("remote.installBtn")}
              </button>
            </div>
          </Show>

          <div class="remote-spacer" />

          <p class="remote-warn">
            <IconWarning size={13} /> {t("remote.warn")}
          </p>
          <button class="remote-stop" onClick={() => props.onStop()}>
            {t("remote.stop")}
          </button>
        </div>
      </div>
    </Show>
  );
}
