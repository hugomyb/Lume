import { invoke } from "@tauri-apps/api/core";

export type ShellSetupHint = {
  shell: string;
  scriptPath: string;
  sourceLine: string;
  rcFile: string;
};

export function getShellSetupHint(): Promise<ShellSetupHint> {
  return invoke<ShellSetupHint>("get_shell_setup_hint");
}

export type InstallResult = {
  rcFile: string;
  /** True when the rc file already sourced the integration (nothing written). */
  already: boolean;
};

/** Append the source line to the user's shell rc file (idempotent). */
export function installShellIntegration(): Promise<InstallResult> {
  return invoke<InstallResult>("install_shell_integration");
}
