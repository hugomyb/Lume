import { createSignal, For, onMount, Show } from "solid-js";
import type { SetStoreFunction } from "solid-js/store";
import Toggle from "./Toggle";
import { DEFAULT_CONFIG, type Config } from "./config";
import {
  remoteClientForget,
  remoteClientPeers,
  remoteRevokeDevice,
  remoteStatus,
  type RemoteDevice,
  type RemotePeer,
} from "./remote";
import { historyClear, relativeTime } from "./history";
import { invoke } from "@tauri-apps/api/core";
import { t } from "./i18n";

/** Settings sections added with the remote / history / workspaces / SSH
 *  features. Same props as the rest of Settings: edit the store, then call
 *  `onChange` so the parent persists (debounced). */
type SectionProps = {
  config: Config;
  setConfig: SetStoreFunction<Config>;
  onChange: () => void;
};

/** Two-step destructive button: first click arms, second click runs. */
function ConfirmButton(props: { label: string; confirm: string; onConfirm: () => void }) {
  const [armed, setArmed] = createSignal(false);
  return (
    <button
      class="remote-revoke"
      classList={{ confirm: armed() }}
      onMouseLeave={() => setArmed(false)}
      onClick={() => {
        if (!armed()) return void setArmed(true);
        setArmed(false);
        props.onConfirm();
      }}
    >
      {armed() ? props.confirm : props.label}
    </button>
  );
}

export function RemoteSection(props: SectionProps) {
  const [devices, setDevices] = createSignal<RemoteDevice[]>([]);
  const [peers, setPeers] = createSignal<RemotePeer[]>([]);
  const reload = () => {
    remoteStatus()
      .then((i) => setDevices(i.devices))
      .catch(() => setDevices([]));
    remoteClientPeers()
      .then(setPeers)
      .catch(() => setPeers([]));
  };
  onMount(reload);

  return (
    <div class="settings-section">
      <label class="settings-row">
        <span class="settings-label">{t("set.remote.port")}</span>
        <input
          class="settings-input narrow"
          type="number"
          min="1024"
          max="65535"
          value={props.config.remote?.port ?? 4530}
          onInput={(e) => {
            const v = Math.round(Number(e.currentTarget.value));
            if (v >= 1024 && v <= 65535) {
              props.setConfig("remote", "port", v);
              props.onChange();
            }
          }}
        />
      </label>
      <div class="settings-row">
        <span class="settings-label">{t("set.remote.autoTunnel")}</span>
        <Toggle
          checked={props.config.remote?.autoTunnel !== false}
          onChange={(v) => {
            props.setConfig("remote", "autoTunnel", v);
            props.onChange();
          }}
        />
      </div>
      <p class="settings-note">{t("set.remote.autoTunnelNote")}</p>

      <div class="settings-subtitle">{t("remote.devicesTitle")}</div>
      <Show
        when={devices().length}
        fallback={<p class="settings-note">{t("remote.noDevices")}</p>}
      >
        <div class="remote-devices">
          <For each={devices()}>
            {(d) => (
              <div class="remote-device">
                <span class="remote-device-dot" classList={{ on: d.connections > 0 }} />
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
                <ConfirmButton
                  label={t("remote.revoke")}
                  confirm={t("remote.revokeConfirm")}
                  onConfirm={() =>
                    void remoteRevokeDevice(d.id)
                      .then((i) => setDevices(i.devices))
                      .catch(() => {})
                  }
                />
              </div>
            )}
          </For>
        </div>
      </Show>

      <div class="settings-subtitle">{t("set.remote.peers")}</div>
      <Show
        when={peers().length}
        fallback={<p class="settings-note">{t("set.remote.noPeers")}</p>}
      >
        <div class="remote-devices">
          <For each={peers()}>
            {(p) => (
              <div class="remote-device">
                <div class="remote-device-main">
                  <span class="remote-device-name">{p.serverName}</span>
                  <span class="remote-device-sub">{p.url}</span>
                </div>
                <ConfirmButton
                  label={t("set.remote.forget")}
                  confirm={t("remote.revokeConfirm")}
                  onConfirm={() => void remoteClientForget(p.serverId).then(reload)}
                />
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

export function HistorySection(props: SectionProps) {
  const [cleared, setCleared] = createSignal(false);
  return (
    <div class="settings-section">
      <div class="settings-row">
        <span class="settings-label">{t("set.history.enabled")}</span>
        <Toggle
          checked={props.config.history?.enabled !== false}
          onChange={(v) => {
            props.setConfig("history", "enabled", v);
            props.onChange();
          }}
        />
      </div>
      <p class="settings-note">{t("set.history.note")}</p>

      <label class="settings-row settings-row-top">
        <span class="settings-label">{t("set.history.ignore")}</span>
        <textarea
          class="settings-input settings-textarea"
          rows={6}
          spellcheck={false}
          disabled={props.config.history?.enabled === false}
          value={(props.config.history?.ignore ?? []).join("\n")}
          onInput={(e) => {
            props.setConfig(
              "history",
              "ignore",
              e.currentTarget.value
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean)
            );
            props.onChange();
          }}
        />
      </label>
      <p class="settings-note" innerHTML={t("set.history.ignoreNote")} />
      <div class="settings-row">
        <span class="settings-label">{t("palette.histClear")}</span>
        <Show
          when={!cleared()}
          fallback={<span class="settings-note">{t("palette.histCleared")}</span>}
        >
          <ConfirmButton
            label={t("set.history.clearBtn")}
            confirm={t("remote.revokeConfirm")}
            onConfirm={() => void historyClear().then(() => setCleared(true))}
          />
        </Show>
      </div>
      <button
        class="settings-reset"
        onClick={() => {
          props.setConfig("history", "ignore", [...DEFAULT_CONFIG.history.ignore]);
          props.onChange();
        }}
      >
        {t("set.history.resetIgnore")}
      </button>

      <div class="settings-subtitle">{t("set.history.blocksTitle")}</div>
      <div class="settings-row">
        <span class="settings-label">{t("set.history.persistBlocks")}</span>
        <Toggle
          checked={props.config.behavior?.persistBlocks !== false}
          onChange={(v) => {
            props.setConfig("behavior", "persistBlocks", v);
            props.onChange();
          }}
        />
      </div>
      <p class="settings-note">{t("set.history.persistBlocksNote")}</p>
    </div>
  );
}

export function WorkspacesSection(props: SectionProps) {
  const [error, setError] = createSignal<string | null>(null);
  return (
    <div class="settings-section">
      <label class="settings-row">
        <span class="settings-label">{t("set.ws.runCommands")}</span>
        <select
          class="settings-input narrow"
          value={props.config.workspaces?.runCommands ?? "always"}
          onChange={(e) => {
            props.setConfig(
              "workspaces",
              "runCommands",
              e.currentTarget.value as Config["workspaces"]["runCommands"]
            );
            props.onChange();
          }}
        >
          <option value="always">{t("set.ws.always")}</option>
          <option value="ask">{t("set.ws.ask")}</option>
          <option value="never">{t("set.ws.never")}</option>
        </select>
      </label>
      <p class="settings-note">{t("set.ws.runNote")}</p>
      <div class="settings-row">
        <span class="settings-label">{t("set.ws.folder")}</span>
        <button
          class="settings-import-btn"
          onClick={() =>
            invoke("open_workspaces_dir").catch((e) => setError(String(e)))
          }
        >
          {t("set.ws.openFolder")}
        </button>
      </div>
      <Show when={error()}>
        <p class="settings-note">{error()}</p>
      </Show>
      <p class="settings-note">{t("set.ws.folderNote")}</p>
    </div>
  );
}

export function SshSection(props: SectionProps) {
  return (
    <div class="settings-section">
      <label class="settings-row">
        <span class="settings-label">{t("set.ssh.tmuxSession")}</span>
        <input
          class="settings-input narrow"
          type="text"
          spellcheck={false}
          placeholder="lume"
          value={props.config.ssh?.tmuxSession ?? "lume"}
          onInput={(e) => {
            // Same charset the ssh command accepts (no quoting needed remotely).
            const v = e.currentTarget.value.replace(/[^A-Za-z0-9_.-]/g, "");
            if (v !== e.currentTarget.value) e.currentTarget.value = v;
            props.setConfig("ssh", "tmuxSession", v || "lume");
            props.onChange();
          }}
        />
      </label>
      <div class="settings-row">
        <span class="settings-label">{t("set.ssh.tmuxDefault")}</span>
        <Toggle
          checked={!!props.config.ssh?.tmuxByDefault}
          onChange={(v) => {
            props.setConfig("ssh", "tmuxByDefault", v);
            props.onChange();
          }}
        />
      </div>
      <p class="settings-note">{t("set.ssh.note")}</p>
    </div>
  );
}
